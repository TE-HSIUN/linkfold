import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import request from 'supertest';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

process.env.BASE_URL = 'http://localhost:3000';

const { default: app } = await import('../src/app.js');
const { hashPassword } = await import('../src/lib/password.js');
const { default: prisma } = await import('../src/lib/prisma.js');
const { generateShortCode } = await import('../src/lib/short-code.js');

const testRunId = randomUUID();
const createdShortCodes = new Set();
const UNPROTECTED_CODE = generateShortCode();
const UNPROTECTED_URL = `https://example.com/linkfold-test/${testRunId}/docs`;
const PROTECTED_CODE = generateShortCode();
const PROTECTED_URL = `https://example.com/linkfold-test/${testRunId}/private-target`;
const PROTECTED_NOTE = '不可出現在密碼頁的備註';
const PROTECTED_PASSWORD = 'correct-horse';
const DISABLED_CODE = generateShortCode();
const DISABLED_PROTECTED_CODE = generateShortCode();
const UNKNOWN_CODE = generateShortCode();

let protectedPasswordHash;

function assertPasswordPage(response, expectedStatus) {
  assert.equal(response.status, expectedStatus);
  assert.match(response.headers['content-type'], /^text\/html\b/);
  assert.match(
    response.text,
    new RegExp(`action=["']/${PROTECTED_CODE}/unlock["']`),
  );
  assert.match(response.text, /method=["']post["']/i);
  assert.match(
    response.text,
    /enctype=["']application\/x-www-form-urlencoded["']/i,
  );
  assert.match(
    response.text,
    /<input[^>]*name=["']password["'][^>]*autocomplete=["']current-password["'][^>]*required/i,
  );
  assert.equal(response.text.includes(PROTECTED_NOTE), false);
  assert.equal(response.text.includes(PROTECTED_URL), false);
  assert.equal(response.text.includes(PROTECTED_PASSWORD), false);
  assert.equal(response.text.includes(protectedPasswordHash), false);
}

function assertBrandedCenteredPasswordPage(response) {
  assert.match(
    response.text,
    /<main[^>]*class=["']page-shell["'][^>]*>/i,
  );
  assert.match(
    response.text,
    /<section[^>]*class=["']password-card["'][^>]*>/i,
  );
  assert.match(
    response.text,
    /\.page-shell\s*\{[^}]*min-height:\s*100(?:vh|dvh);[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/is,
  );
  assert.match(response.text, /background-color:\s*#f7faf9;/i);
  assert.match(
    response.text,
    /\.password-card\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*28rem;[^}]*background:\s*#fff;[^}]*border:\s*1px solid #e2e8f0;[^}]*border-radius:\s*2rem;[^}]*box-shadow:/is,
  );
  assert.match(response.text, /color:\s*#0f172a;/i);
  assert.match(
    response.text,
    /input:focus\s*\{[^}]*border-color:\s*#14b8a6;[^}]*box-shadow:\s*0 0 0 4px rgba\(20,\s*184,\s*166,\s*0\.1\);/is,
  );
  assert.match(
    response.text,
    /button\s*\{[^}]*background:\s*#0f172a;[^}]*color:\s*#fff;/is,
  );
}

before(async () => {
  protectedPasswordHash = await hashPassword(PROTECTED_PASSWORD);

  await prisma.link.create({
    data: {
      shortCode: UNPROTECTED_CODE,
      originalUrl: UNPROTECTED_URL,
    },
  });
  createdShortCodes.add(UNPROTECTED_CODE);

  await prisma.link.create({
    data: {
      shortCode: PROTECTED_CODE,
      originalUrl: PROTECTED_URL,
      note: PROTECTED_NOTE,
      passwordHash: protectedPasswordHash,
    },
  });
  createdShortCodes.add(PROTECTED_CODE);

  await prisma.link.create({
    data: {
      shortCode: DISABLED_CODE,
      originalUrl: `https://example.com/linkfold-test/${testRunId}/disabled`,
      isEnabled: false,
    },
  });
  createdShortCodes.add(DISABLED_CODE);

  await prisma.link.create({
    data: {
      shortCode: DISABLED_PROTECTED_CODE,
      originalUrl: `https://example.com/linkfold-test/${testRunId}/disabled-private`,
      passwordHash: protectedPasswordHash,
      isEnabled: false,
    },
  });
  createdShortCodes.add(DISABLED_PROTECTED_CODE);

  assert.equal(
    await prisma.link.findUnique({ where: { shortCode: UNKNOWN_CODE } }),
    null,
    `${UNKNOWN_CODE} 必須保留給未知短碼測試`,
  );
});

after(async () => {
  await prisma.link.deleteMany({
    where: {
      shortCode: {
        in: [...createdShortCodes],
      },
    },
  });
});

describe('短碼轉址', () => {
  test('已知且未受保護的短碼以 302 轉址', async () => {
    const response = await request(app).get(`/${UNPROTECTED_CODE}`);

    assert.equal(response.status, 302);
    assert.equal(response.headers.location, UNPROTECTED_URL);
    assert.equal(response.text, '');
  });

  describe('受密碼保護的短碼', () => {
    test('GET 顯示不洩漏連結資料的密碼表單', async () => {
      const response = await request(app).get(`/${PROTECTED_CODE}`);

      assertPasswordPage(response, 200);
    });

    test('GET 顯示置中且與建立頁一致的密碼卡片', async () => {
      const response = await request(app).get(`/${PROTECTED_CODE}`);

      assertBrandedCenteredPasswordPage(response);
    });

    test('正確密碼以 302 轉址且不建立 session', async () => {
      const response = await request(app)
        .post(`/${PROTECTED_CODE}/unlock`)
        .type('form')
        .send({ password: PROTECTED_PASSWORD });

      assert.equal(response.status, 302);
      assert.equal(response.headers.location, PROTECTED_URL);
      assert.equal(response.text, '');
      assert.equal(response.headers['set-cookie'], undefined);
    });

    test('錯誤密碼回 401 密碼表單', async () => {
      const response = await request(app)
        .post(`/${PROTECTED_CODE}/unlock`)
        .type('form')
        .send({ password: 'wrong-password' });

      assertPasswordPage(response, 401);
      assertBrandedCenteredPasswordPage(response);
      assert.match(
        response.text,
        /<p[^>]*role=["']alert["'][^>]*>密碼錯誤，請再試一次。<\/p>/i,
      );
    });

    test('缺少密碼回 401 密碼表單', async () => {
      const response = await request(app)
        .post(`/${PROTECTED_CODE}/unlock`)
        .type('form')
        .send({});

      assertPasswordPage(response, 401);
    });

    test('解鎖後再次 GET 仍顯示密碼表單', async () => {
      const agent = request.agent(app);
      const unlockResponse = await agent
        .post(`/${PROTECTED_CODE}/unlock`)
        .type('form')
        .send({ password: PROTECTED_PASSWORD });

      assert.equal(unlockResponse.status, 302);

      const subsequentResponse = await agent.get(`/${PROTECTED_CODE}`);

      assertPasswordPage(subsequentResponse, 200);
    });
  });

  describe('未知短碼', () => {
    test('GET 回 404 NOT_FOUND', async () => {
      const response = await request(app).get(`/${UNKNOWN_CODE}`);

      assert.equal(response.status, 404);
      assert.equal(response.body.error.code, 'NOT_FOUND');
    });

    test('unlock POST 回 404 NOT_FOUND', async () => {
      const response = await request(app)
        .post(`/${UNKNOWN_CODE}/unlock`)
        .type('form')
        .send({ password: 'any-password' });

      assert.equal(response.status, 404);
      assert.equal(response.body.error.code, 'NOT_FOUND');
    });
  });

  describe('停用短碼', () => {
    test('未受保護的 GET 回 404 且不轉址', async () => {
      const response = await request(app).get(`/${DISABLED_CODE}`);

      assert.equal(response.status, 404);
      assert.equal(response.body.error.code, 'NOT_FOUND');
      assert.equal(response.headers.location, undefined);
    });

    test('受保護的 GET 回 404 且不顯示密碼頁', async () => {
      const response = await request(app).get(
        `/${DISABLED_PROTECTED_CODE}`,
      );

      assert.equal(response.status, 404);
      assert.equal(response.body.error.code, 'NOT_FOUND');
      assert.doesNotMatch(
        response.text,
        /此短網址需要密碼/,
      );
    });

    test('受保護的 unlock 回 404 且不轉址', async () => {
      const response = await request(app)
        .post(`/${DISABLED_PROTECTED_CODE}/unlock`)
        .type('form')
        .send({ password: PROTECTED_PASSWORD });

      assert.equal(response.status, 404);
      assert.equal(response.body.error.code, 'NOT_FOUND');
      assert.equal(response.headers.location, undefined);
    });
  });

  describe('保留路徑', () => {
    test('/health 仍由健康檢查處理', async () => {
      const response = await request(app).get('/health');

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { status: 'ok' });
    });

    test('/api/links 仍由建立 API 處理', async () => {
      const response = await request(app)
        .post('/api/links')
        .send({
          originalUrl: `https://example.com/linkfold-test/${testRunId}/reserved-api-path`,
        });

      assert.equal(response.status, 201);
      createdShortCodes.add(response.body.shortCode);
    });
  });
});
