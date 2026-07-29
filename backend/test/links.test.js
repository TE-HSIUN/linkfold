import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, test } from 'node:test';

import express from 'express';
import request from 'supertest';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

process.env.BASE_URL = 'http://localhost:3000';

const { default: app } = await import('../src/app.js');
const { default: prisma } = await import('../src/lib/prisma.js');
const { verifyPassword } = await import('../src/lib/password.js');
const { createLinksRouter } = await import('../src/routes/links.js');

const SUCCESS_RESPONSE_FIELDS = [
  'createdAt',
  'note',
  'originalUrl',
  'passwordProtected',
  'shortCode',
  'shortUrl',
];

async function assertRejectedWithoutWrite(body, errorCode) {
  const countBefore = await prisma.link.count();
  const response = await request(app).post('/api/links').send(body);
  const countAfter = await prisma.link.count();

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, errorCode);
  assert.equal(countAfter, countBefore);
}

function assertSuccessfulResponse(response, expected) {
  assert.equal(response.status, 201);
  assert.deepEqual(Object.keys(response.body).sort(), SUCCESS_RESPONSE_FIELDS);
  assert.match(response.body.shortCode, /^[0-9A-Za-z]{7}$/);
  assert.equal(
    response.body.shortUrl,
    `${process.env.BASE_URL}/${response.body.shortCode}`,
  );
  assert.equal(response.body.originalUrl, expected.originalUrl);
  assert.equal(response.body.note, expected.note);
  assert.equal(
    response.body.passwordProtected,
    expected.passwordProtected,
  );
  assert.equal(
    new Date(response.body.createdAt).toISOString(),
    response.body.createdAt,
  );
  assert.equal('password' in response.body, false);
  assert.equal('passwordHash' in response.body, false);
}

function createInjectedApp(router) {
  const injectedApp = express();

  injectedApp.use(express.json());
  injectedApp.use('/api/links', router);
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

describe('POST /api/links', () => {
  test('以合法網址建立未受保護的短網址', async () => {
    const originalUrl = 'https://example.com/a/very/long/path';
    const response = await request(app)
      .post('/api/links')
      .send({ originalUrl });

    assertSuccessfulResponse(response, {
      originalUrl,
      note: null,
      passwordProtected: false,
    });
  });

  test('選填備註與密碼會安全儲存', async () => {
    const originalUrl = 'https://example.com/private';
    const password = 'correct-horse';
    const response = await request(app).post('/api/links').send({
      originalUrl,
      note: 'Project draft',
      password,
    });

    assertSuccessfulResponse(response, {
      originalUrl,
      note: 'Project draft',
      passwordProtected: true,
    });

    const storedLink = await prisma.link.findUnique({
      where: { shortCode: response.body.shortCode },
    });

    assert.ok(storedLink.passwordHash);
    assert.notEqual(storedLink.passwordHash, password);
    assert.equal(await verifyPassword(password, storedLink.passwordHash), true);
  });

  test('同一網址分開建立時得到不同短碼', async () => {
    const originalUrl = 'https://example.com/docs';
    const [firstResponse, secondResponse] = await Promise.all([
      request(app).post('/api/links').send({ originalUrl }),
      request(app).post('/api/links').send({ originalUrl }),
    ]);

    assert.equal(firstResponse.status, 201);
    assert.equal(secondResponse.status, 201);
    assert.notEqual(
      firstResponse.body.shortCode,
      secondResponse.body.shortCode,
    );
  });

  describe('originalUrl 驗證', () => {
    const rejectedInputs = [
      {},
      { originalUrl: '' },
      { originalUrl: 'not-a-url' },
      { originalUrl: 'javascript:alert(1)' },
      { originalUrl: 42 },
    ];

    for (const body of rejectedInputs) {
      test(`拒絕 ${JSON.stringify(body)}`, async () => {
        await assertRejectedWithoutWrite(body, 'INVALID_URL');
      });
    }

    test('接受 http 網址', async () => {
      const originalUrl = 'http://example.com';
      const response = await request(app)
        .post('/api/links')
        .send({ originalUrl });

      assertSuccessfulResponse(response, {
        originalUrl,
        note: null,
        passwordProtected: false,
      });
    });
  });

  describe('note 驗證', () => {
    test('接受空字串備註', async () => {
      const originalUrl = 'https://example.com/empty-note';
      const response = await request(app)
        .post('/api/links')
        .send({ originalUrl, note: '' });

      assertSuccessfulResponse(response, {
        originalUrl,
        note: '',
        passwordProtected: false,
      });
    });

    test('接受 500 字元備註', async () => {
      const originalUrl = 'https://example.com/500-character-note';
      const note = '備'.repeat(500);
      const response = await request(app)
        .post('/api/links')
        .send({ originalUrl, note });

      assertSuccessfulResponse(response, {
        originalUrl,
        note,
        passwordProtected: false,
      });
    });

    test('拒絕 501 字元備註', async () => {
      await assertRejectedWithoutWrite(
        {
          originalUrl: 'https://example.com/501-character-note',
          note: '備'.repeat(501),
        },
        'INVALID_NOTE',
      );
    });

    test('拒絕非字串備註', async () => {
      await assertRejectedWithoutWrite(
        {
          originalUrl: 'https://example.com/non-string-note',
          note: 42,
        },
        'INVALID_NOTE',
      );
    });
  });

  describe('password 驗證', () => {
    test('接受 8 字元密碼', async () => {
      const originalUrl = 'https://example.com/8-character-password';
      const response = await request(app)
        .post('/api/links')
        .send({ originalUrl, password: '12345678' });

      assertSuccessfulResponse(response, {
        originalUrl,
        note: null,
        passwordProtected: true,
      });
    });

    test('接受 128 字元密碼', async () => {
      const originalUrl = 'https://example.com/128-character-password';
      const response = await request(app)
        .post('/api/links')
        .send({ originalUrl, password: 'p'.repeat(128) });

      assertSuccessfulResponse(response, {
        originalUrl,
        note: null,
        passwordProtected: true,
      });
    });

    test('拒絕 7 字元密碼', async () => {
      await assertRejectedWithoutWrite(
        {
          originalUrl: 'https://example.com/7-character-password',
          password: '1234567',
        },
        'INVALID_PASSWORD',
      );
    });

    test('拒絕 129 字元密碼', async () => {
      await assertRejectedWithoutWrite(
        {
          originalUrl: 'https://example.com/129-character-password',
          password: 'p'.repeat(129),
        },
        'INVALID_PASSWORD',
      );
    });

    test('拒絕 null 密碼', async () => {
      await assertRejectedWithoutWrite(
        {
          originalUrl: 'https://example.com/null-password',
          password: null,
        },
        'INVALID_PASSWORD',
      );
    });
  });

  describe('短碼碰撞重試', () => {
    test('碰撞後改用下一組未使用短碼', async () => {
      const generatedCodes = ['AAAAAAA', 'BBBBBBB'];
      let createAttempts = 0;
      const prismaClient = {
        link: {
          async create({ data }) {
            createAttempts += 1;

            if (createAttempts === 1) {
              throw Object.assign(new Error('Unique constraint failed'), {
                code: 'P2002',
              });
            }

            return {
              id: 1,
              ...data,
              createdAt: new Date('2026-07-27T10:00:00.000Z'),
            };
          },
        },
      };
      const router = createLinksRouter({
        prismaClient,
        codeGenerator: () => generatedCodes.shift(),
      });
      const response = await request(createInjectedApp(router))
        .post('/api/links')
        .send({ originalUrl: 'https://example.com/collision' });

      assert.equal(response.status, 201);
      assert.equal(response.body.shortCode, 'BBBBBBB');
      assert.equal(createAttempts, 2);
    });

    test('連續碰撞 5 次後回 INTERNAL_ERROR', async () => {
      let createAttempts = 0;
      const prismaClient = {
        link: {
          async create() {
            createAttempts += 1;
            throw Object.assign(new Error('Unique constraint failed'), {
              code: 'P2002',
            });
          },
        },
      };
      const router = createLinksRouter({
        prismaClient,
        codeGenerator: () => 'AAAAAAA',
      });
      const response = await request(createInjectedApp(router))
        .post('/api/links')
        .send({ originalUrl: 'https://example.com/persistent-collision' });

      assert.equal(response.status, 500);
      assert.equal(response.body.error.code, 'INTERNAL_ERROR');
      assert.equal(createAttempts, 5);
    });
  });
});
