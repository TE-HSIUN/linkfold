import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { describe, test } from 'node:test';

import express from 'express';
import request from 'supertest';

import {
  createHttpFetcher,
  createPageMetadataService,
  extractPageMetadata,
  isPublicAddress,
} from '../src/lib/page-metadata.js';
import app from '../src/app.js';
import { createPageMetadataRouter } from '../src/routes/page-metadata.js';

const PUBLIC_IPV4 = '93.184.216.34';
const PUBLIC_IPV6 = '2606:2800:220:1:248:1893:25c8:1946';
const ONE_MIB = 1024 * 1024;

function publicResolver() {
  return [{ address: PUBLIC_IPV4, family: 4 }];
}

function htmlResponse(body, overrides = {}) {
  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
    body: Buffer.from(body),
    ...overrides,
  };
}

function assertHttpError(error, status, code) {
  return (
    error?.status === status &&
    error?.code === code &&
    typeof error.message === 'string'
  );
}

function fakeRequest(responseFactory, captureOptions = () => {}) {
  return (options, onResponse) => {
    captureOptions(options);
    const req = new EventEmitter();

    req.destroy = () => {};
    req.end = () => {
      queueMicrotask(() => onResponse(responseFactory()));
    };

    return req;
  };
}

function readableResponse({
  chunks,
  statusCode = 200,
  headers = { 'content-type': 'text/html' },
}) {
  const response = Readable.from(chunks);

  response.statusCode = statusCode;
  response.headers = headers;

  return response;
}

function createInjectedApp(metadataService) {
  const injectedApp = express();

  injectedApp.use(express.json());
  injectedApp.use(
    '/api/page-metadata',
    createPageMetadataRouter({ metadataService }),
  );
  injectedApp.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(error.status ?? 500).json({
      error: {
        code: error.status ? error.code : 'INTERNAL_ERROR',
        message: error.status ? error.message : '伺服器發生錯誤',
      },
    });
  });

  return injectedApp;
}

describe('頁面 metadata 解析', () => {
  test('正規化並限制 title 與 description', () => {
    const title = `  Example\n   Docs ${'標'.repeat(400)} `;
    const description = ` Reference\tguide ${'述'.repeat(600)} `;
    const metadata = extractPageMetadata(`
      <!doctype html>
      <html>
        <head>
          <title>${title}</title>
          <meta name="DESCRIPTION" content="${description}">
        </head>
      </html>
    `);

    assert.equal(metadata.title.length, 300);
    assert.match(metadata.title, /^Example Docs/);
    assert.equal(metadata.description.length, 500);
    assert.match(metadata.description, /^Reference guide/);
  });

  test('缺少 metadata 時回空字串', () => {
    assert.deepEqual(extractPageMetadata('<html><body>Hi</body></html>'), {
      title: '',
      description: '',
    });
  });
});

describe('公開 IP 判斷', () => {
  test('接受公開 IPv4 與 IPv6', () => {
    assert.equal(isPublicAddress(PUBLIC_IPV4), true);
    assert.equal(isPublicAddress(PUBLIC_IPV6), true);
  });

  for (const address of [
    '0.0.0.0',
    '10.0.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
  ]) {
    test(`拒絕非公開位址 ${address}`, () => {
      assert.equal(isPublicAddress(address), false);
    });
  }
});

describe('固定 IP HTTP 擷取', () => {
  test('以原 hostname 與固定 lookup 發送 identity 請求', async () => {
    let requestOptions;
    const fetchOnce = createHttpFetcher({
      httpRequest: fakeRequest(
        () =>
          readableResponse({
            chunks: [Buffer.from('<title>Docs</title>')],
          }),
        (options) => {
          requestOptions = options;
        },
      ),
      httpsRequest: fakeRequest(
        () =>
          readableResponse({
            chunks: [Buffer.from('<title>Docs</title>')],
          }),
        (options) => {
          requestOptions = options;
        },
      ),
    });
    const controller = new AbortController();
    const response = await fetchOnce({
      url: new URL('https://example.com/docs?q=vue'),
      address: PUBLIC_IPV4,
      family: 4,
      signal: controller.signal,
      maxBytes: ONE_MIB,
    });

    assert.equal(requestOptions.hostname, 'example.com');
    assert.equal(requestOptions.servername, 'example.com');
    assert.equal(requestOptions.path, '/docs?q=vue');
    assert.equal(requestOptions.headers['accept-encoding'], 'identity');
    assert.equal(requestOptions.signal, controller.signal);
    assert.equal(response.body.toString(), '<title>Docs</title>');

    let lookupResult;
    requestOptions.lookup('example.com', {}, (error, address, family) => {
      assert.equal(error, null);
      lookupResult = { address, family };
    });
    assert.deepEqual(lookupResult, {
      address: PUBLIC_IPV4,
      family: 4,
    });

    let lookupAllResult;
    requestOptions.lookup(
      'example.com',
      { all: true },
      (error, addresses) => {
        assert.equal(error, null);
        lookupAllResult = addresses;
      },
    );
    assert.deepEqual(lookupAllResult, [
      {
        address: PUBLIC_IPV4,
        family: 4,
      },
    ]);
  });

  test('串流內容超過 maxBytes 時停止並回 METADATA_UNAVAILABLE', async () => {
    const fetchOnce = createHttpFetcher({
      httpsRequest: fakeRequest(() =>
        readableResponse({
          chunks: [Buffer.alloc(6, 'a'), Buffer.alloc(6, 'b')],
        }),
      ),
    });

    await assert.rejects(
      fetchOnce({
        url: new URL('https://example.com/large'),
        address: PUBLIC_IPV4,
        family: 4,
        signal: new AbortController().signal,
        maxBytes: 10,
      }),
      (error) =>
        assertHttpError(error, 422, 'METADATA_UNAVAILABLE'),
    );
  });
});

describe('頁面 metadata 擷取服務', () => {
  test('擷取公開 HTML 的 title 與 description', async () => {
    const service = createPageMetadataService({
      resolver: publicResolver,
      fetchOnce: async () =>
        htmlResponse(`
          <title>Example Docs</title>
          <meta name="description" content="Reference guide">
        `),
    });

    assert.deepEqual(await service('https://example.com/docs'), {
      title: 'Example Docs',
      description: 'Reference guide',
    });
  });

  test('不安全的初始網址在連線前回 INVALID_URL', async () => {
    let fetchCalls = 0;
    const service = createPageMetadataService({
      resolver: async () => [{ address: '127.0.0.1', family: 4 }],
      fetchOnce: async () => {
        fetchCalls += 1;
        return htmlResponse('');
      },
    });

    await assert.rejects(
      service('http://localhost/'),
      (error) => assertHttpError(error, 400, 'INVALID_URL'),
    );
    assert.equal(fetchCalls, 0);
  });

  for (const originalUrl of [
    'ftp://example.com/',
    'http://example.com:8080/',
    'https://user:secret@example.com/',
    'not-a-url',
  ]) {
    test(`拒絕網址 ${originalUrl}`, async () => {
      const service = createPageMetadataService({
        resolver: publicResolver,
        fetchOnce: async () => htmlResponse(''),
      });

      await assert.rejects(
        service(originalUrl),
        (error) => assertHttpError(error, 400, 'INVALID_URL'),
      );
    });
  }

  test('重新導向到私有位址時停止且不連線第二跳', async () => {
    let fetchCalls = 0;
    const service = createPageMetadataService({
      resolver: async (hostname) => [
        {
          address:
            hostname === 'example.com' ? PUBLIC_IPV4 : '10.0.0.1',
          family: 4,
        },
      ],
      fetchOnce: async () => {
        fetchCalls += 1;
        return {
          statusCode: 302,
          headers: { location: 'http://internal.test/private' },
          body: Buffer.alloc(0),
        };
      },
    });

    await assert.rejects(
      service('https://example.com/start'),
      (error) => assertHttpError(error, 400, 'INVALID_URL'),
    );
    assert.equal(fetchCalls, 1);
  });

  test('超過三次重新導向回 METADATA_UNAVAILABLE', async () => {
    let fetchCalls = 0;
    const service = createPageMetadataService({
      resolver: publicResolver,
      fetchOnce: async () => {
        fetchCalls += 1;
        return {
          statusCode: 302,
          headers: { location: `/step-${fetchCalls}` },
          body: Buffer.alloc(0),
        };
      },
    });

    await assert.rejects(
      service('https://example.com/start'),
      (error) =>
        assertHttpError(error, 422, 'METADATA_UNAVAILABLE'),
    );
    assert.equal(fetchCalls, 4);
  });

  test('五秒 deadline 到期會 abort 並回 METADATA_UNAVAILABLE', async () => {
    let aborted = false;
    const service = createPageMetadataService({
      resolver: publicResolver,
      timeoutMs: 10,
      fetchOnce: ({ signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              aborted = true;
              reject(signal.reason);
            },
            { once: true },
          );
        }),
    });

    await assert.rejects(
      service('https://example.com/slow'),
      (error) =>
        assertHttpError(error, 422, 'METADATA_UNAVAILABLE'),
    );
    assert.equal(aborted, true);
  });

  test('超過 1 MiB 回 METADATA_UNAVAILABLE', async () => {
    const service = createPageMetadataService({
      resolver: publicResolver,
      fetchOnce: async () =>
        htmlResponse(Buffer.alloc(ONE_MIB + 1, 'a')),
    });

    await assert.rejects(
      service('https://example.com/large'),
      (error) =>
        assertHttpError(error, 422, 'METADATA_UNAVAILABLE'),
    );
  });

  test('非 HTML content type 回 METADATA_UNAVAILABLE', async () => {
    const service = createPageMetadataService({
      resolver: publicResolver,
      fetchOnce: async () => ({
        statusCode: 200,
        headers: { 'content-type': 'application/pdf' },
        body: Buffer.from('%PDF'),
      }),
    });

    await assert.rejects(
      service('https://example.com/file.pdf'),
      (error) =>
        assertHttpError(error, 422, 'METADATA_UNAVAILABLE'),
    );
  });
});

describe('POST /api/page-metadata', () => {
  test('回傳 exactly title 與 description', async () => {
    let receivedUrl;
    const response = await request(
      createInjectedApp(async (originalUrl) => {
        receivedUrl = originalUrl;
        return {
          title: 'Example Docs',
          description: 'Reference guide',
        };
      }),
    )
      .post('/api/page-metadata')
      .send({ originalUrl: 'https://example.com/docs' });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      title: 'Example Docs',
      description: 'Reference guide',
    });
    assert.equal(receivedUrl, 'https://example.com/docs');
  });

  test('缺少 metadata 時回兩個空字串', async () => {
    const response = await request(
      createInjectedApp(async () => ({
        title: '',
        description: '',
      })),
    )
      .post('/api/page-metadata')
      .send({ originalUrl: 'https://example.com/empty' });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      title: '',
      description: '',
    });
  });

  test('保留安全錯誤形狀且不洩漏底層訊息', async () => {
    const metadataError = Object.assign(
      new Error('無法取得頁面資訊'),
      {
        status: 422,
        code: 'METADATA_UNAVAILABLE',
      },
    );
    const response = await request(
      createInjectedApp(async () => {
        throw metadataError;
      }),
    )
      .post('/api/page-metadata')
      .send({ originalUrl: 'https://example.com/failure' });

    assert.equal(response.status, 422);
    assert.deepEqual(response.body, {
      error: {
        code: 'METADATA_UNAVAILABLE',
        message: '無法取得頁面資訊',
      },
    });
  });

  test('具名 metadata 路由不會被短碼路由吃掉', async () => {
    const response = await request(app)
      .post('/api/page-metadata')
      .send({ originalUrl: 'not-a-url' });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'INVALID_URL');
  });
});
