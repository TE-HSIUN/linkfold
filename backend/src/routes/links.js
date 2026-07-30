import { Router } from 'express';

import { hashPassword } from '../lib/password.js';
import prisma from '../lib/prisma.js';
import { generateShortCode } from '../lib/short-code.js';

const CUSTOM_SHORT_CODE_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{2,30}[a-z0-9])$/;
const RESERVED_SHORT_CODES = new Set(['api', 'health']);

function validationError(code, message) {
  return Object.assign(new Error(message), {
    status: 400,
    code,
  });
}

function validateOriginalUrl(originalUrl) {
  if (typeof originalUrl !== 'string') {
    throw validationError(
      'INVALID_URL',
      'originalUrl 必須是 http 或 https 網址',
    );
  }

  try {
    const url = new URL(originalUrl);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw validationError(
        'INVALID_URL',
        'originalUrl 必須是 http 或 https 網址',
      );
    }
  } catch (error) {
    if (error.code === 'INVALID_URL') {
      throw error;
    }

    throw validationError(
      'INVALID_URL',
      'originalUrl 必須是 http 或 https 網址',
    );
  }
}

function validateOptionalFields(body) {
  if (
    Object.hasOwn(body, 'note') &&
    (typeof body.note !== 'string' || body.note.length > 500)
  ) {
    throw validationError(
      'INVALID_NOTE',
      'note 必須是不超過 500 字元的字串',
    );
  }

  if (
    Object.hasOwn(body, 'password') &&
    (typeof body.password !== 'string' ||
      body.password.length < 8 ||
      body.password.length > 128)
  ) {
    throw validationError(
      'INVALID_PASSWORD',
      'password 必須是 8 至 128 字元的字串',
    );
  }

  if (
    Object.hasOwn(body, 'shortCode') &&
    (typeof body.shortCode !== 'string' ||
      !CUSTOM_SHORT_CODE_PATTERN.test(body.shortCode) ||
      RESERVED_SHORT_CODES.has(body.shortCode))
  ) {
    throw validationError(
      'INVALID_SHORT_CODE',
      'shortCode 必須是 4 至 32 個小寫英數字元或連字號，且不可使用保留路徑',
    );
  }

  if (
    Object.hasOwn(body, 'enabled') &&
    typeof body.enabled !== 'boolean'
  ) {
    throw validationError(
      'INVALID_ENABLED',
      'enabled 必須是 boolean',
    );
  }
}

function shortCodeConflictError() {
  return Object.assign(new Error('此短碼已被使用'), {
    status: 409,
    code: 'SHORT_CODE_TAKEN',
  });
}

export function createLinksRouter({
  prismaClient = prisma,
  codeGenerator = generateShortCode,
  passwordHasher = hashPassword,
} = {}) {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const body =
        req.body !== null && typeof req.body === 'object' ? req.body : {};

      validateOriginalUrl(body.originalUrl);
      validateOptionalFields(body);

      const note = Object.hasOwn(body, 'note') ? body.note : null;
      const passwordHash = Object.hasOwn(body, 'password')
        ? await passwordHasher(body.password)
        : null;
      const isCustomShortCode = Object.hasOwn(body, 'shortCode');
      const isEnabled = Object.hasOwn(body, 'enabled')
        ? body.enabled
        : true;
      const maxAttempts = isCustomShortCode ? 1 : 5;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const shortCode = isCustomShortCode
          ? body.shortCode
          : codeGenerator();

        try {
          const link = await prismaClient.link.create({
            data: {
              shortCode,
              originalUrl: body.originalUrl,
              note,
              passwordHash,
              isEnabled,
            },
          });
          const baseUrl = process.env.BASE_URL.replace(/\/+$/, '');

          res.status(201).json({
            shortCode: link.shortCode,
            shortUrl: `${baseUrl}/${link.shortCode}`,
            originalUrl: link.originalUrl,
            note: link.note,
            passwordProtected: link.passwordHash !== null,
            enabled: link.isEnabled,
            createdAt: link.createdAt,
          });
          return;
        } catch (error) {
          if (error.code === 'P2002' && isCustomShortCode) {
            throw shortCodeConflictError();
          }

          if (
            error.code !== 'P2002' ||
            attempt === maxAttempts - 1
          ) {
            throw error;
          }
        }
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}

const router = createLinksRouter();

export default router;
