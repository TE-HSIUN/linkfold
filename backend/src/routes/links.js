import { Router } from 'express';

import { hashPassword } from '../lib/password.js';
import prisma from '../lib/prisma.js';
import { generateShortCode } from '../lib/short-code.js';

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

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const shortCode = codeGenerator();

        try {
          const link = await prismaClient.link.create({
            data: {
              shortCode,
              originalUrl: body.originalUrl,
              note,
              passwordHash,
            },
          });
          const baseUrl = process.env.BASE_URL.replace(/\/+$/, '');

          res.status(201).json({
            shortCode: link.shortCode,
            shortUrl: `${baseUrl}/${link.shortCode}`,
            originalUrl: link.originalUrl,
            note: link.note,
            passwordProtected: link.passwordHash !== null,
            createdAt: link.createdAt,
          });
          return;
        } catch (error) {
          if (error.code !== 'P2002' || attempt === 4) {
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
