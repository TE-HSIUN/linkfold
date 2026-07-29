import { Router } from 'express';

import { verifyPassword } from '../lib/password.js';
import prisma from '../lib/prisma.js';

const router = Router();

function notFoundError() {
  return Object.assign(new Error('找不到短網址'), {
    status: 404,
    code: 'NOT_FOUND',
  });
}

function passwordForm(shortCode) {
  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>輸入短網址密碼</title>
  </head>
  <body>
    <main>
      <h1>此短網址需要密碼</h1>
      <form method="post" action="/${shortCode}/unlock" enctype="application/x-www-form-urlencoded">
        <label for="password">密碼</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required>
        <button type="submit">前往連結</button>
      </form>
    </main>
  </body>
</html>`;
}

function sendPasswordForm(res, shortCode, status) {
  res.status(status).type('html').send(passwordForm(shortCode));
}

router.get('/:code', async (req, res, next) => {
  try {
    const link = await prisma.link.findUnique({
      where: { shortCode: req.params.code },
    });

    if (!link) {
      throw notFoundError();
    }

    if (link.passwordHash !== null) {
      sendPasswordForm(res, link.shortCode, 200);
      return;
    }

    res.status(302).set('Location', link.originalUrl).end();
  } catch (error) {
    next(error);
  }
});

router.post('/:code/unlock', async (req, res, next) => {
  try {
    const link = await prisma.link.findUnique({
      where: { shortCode: req.params.code },
    });

    if (!link) {
      throw notFoundError();
    }

    const passwordIsValid =
      typeof req.body.password === 'string' &&
      link.passwordHash !== null &&
      (await verifyPassword(req.body.password, link.passwordHash));

    if (!passwordIsValid) {
      sendPasswordForm(res, link.shortCode, 401);
      return;
    }

    res.status(302).set('Location', link.originalUrl).end();
  } catch (error) {
    next(error);
  }
});

export default router;
