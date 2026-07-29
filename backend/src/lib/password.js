import { createHash } from 'node:crypto';

import bcrypt from 'bcrypt';

const BCRYPT_COST = 12;

function digestPassword(password) {
  return createHash('sha256').update(password, 'utf8').digest('base64');
}

export function hashPassword(password) {
  return bcrypt.hash(digestPassword(password), BCRYPT_COST);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(digestPassword(password), passwordHash);
}
