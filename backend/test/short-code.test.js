import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { generateShortCode } from '../src/lib/short-code.js';

describe('generateShortCode', () => {
  test('預設產生 7 個字元', () => {
    assert.equal(generateShortCode().length, 7);
  });

  test('只使用 0-9A-Za-z 字元', () => {
    assert.match(generateShortCode(), /^[0-9A-Za-z]{7}$/);
  });

  test('連續產生 1000 次不重複', () => {
    const codes = new Set(
      Array.from({ length: 1000 }, () => generateShortCode()),
    );

    assert.equal(codes.size, 1000);
  });
});
