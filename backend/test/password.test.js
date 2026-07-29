import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

import bcrypt from 'bcrypt';

import { hashPassword, verifyPassword } from '../src/lib/password.js';

describe('password helper', () => {
  const password = 'correct-horse';
  let passwordHash;

  before(async () => {
    passwordHash = await hashPassword(password);
  });

  test('雜湊不等於原始密碼', () => {
    assert.notEqual(passwordHash, password);
  });

  test('使用 bcrypt cost 12', () => {
    assert.equal(bcrypt.getRounds(passwordHash), 12);
  });

  test('正確密碼比對成功', async () => {
    assert.equal(await verifyPassword(password, passwordHash), true);
  });

  test('錯誤密碼比對失敗', async () => {
    assert.equal(await verifyPassword('wrong-password', passwordHash), false);
  });

  test('前 72 bytes 相同但尾端不同的密碼不可互相通過', async () => {
    const sharedPrefix = 'a'.repeat(72);
    const firstPasswordHash = await hashPassword(`${sharedPrefix}x`);

    assert.equal(
      await verifyPassword(`${sharedPrefix}y`, firstPasswordHash),
      false,
    );
  });
});
