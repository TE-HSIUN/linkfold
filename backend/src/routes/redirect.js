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

function passwordForm(shortCode, errorMessage = '') {
  const errorMarkup = errorMessage
    ? `<p class="form-error" role="alert">${errorMessage}</p>`
    : '';

  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>輸入短網址密碼</title>
    <style>
      :root {
        color: #0f172a;
        background-color: #f7faf9;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-synthesis: none;
        text-rendering: optimizeLegibility;
      }

      * {
        box-sizing: border-box;
      }

      body {
        min-width: 0;
        min-height: 100vh;
        margin: 0;
      }

      .page-shell {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem 1rem;
        background-color: #f7faf9;
        background-image: radial-gradient(circle at top left, rgba(13, 148, 136, 0.12), transparent 32rem);
      }

      .password-card {
        width: 100%;
        max-width: 28rem;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 2rem;
        box-shadow: 0 24px 80px -40px rgba(15, 23, 42, 0.35);
        padding: 2rem;
      }

      .eyebrow {
        margin: 0;
        color: #0f766e;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.24em;
      }

      h1 {
        margin: 0.75rem 0 0;
        color: #020617;
        font-size: clamp(1.75rem, 8vw, 2.25rem);
        line-height: 1.15;
        letter-spacing: -0.025em;
      }

      .description {
        margin: 1rem 0 0;
        color: #475569;
        line-height: 1.75;
      }

      form {
        margin-top: 2rem;
      }

      label {
        display: block;
        margin-bottom: 0.5rem;
        color: #1e293b;
        font-size: 0.875rem;
        font-weight: 600;
      }

      input {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 1rem;
        background: #fff;
        padding: 0.75rem 1rem;
        color: #020617;
        font: inherit;
        outline: none;
        transition: border-color 150ms ease, box-shadow 150ms ease;
      }

      input:focus {
        border-color: #14b8a6;
        box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.1);
      }

      .form-error {
        margin: 0.5rem 0 0;
        color: #be123c;
        font-size: 0.875rem;
      }

      button {
        width: 100%;
        margin-top: 1.5rem;
        border: 0;
        border-radius: 1rem;
        background: #0f172a;
        color: #fff;
        padding: 0.875rem 1.25rem;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        transition: background-color 150ms ease, transform 150ms ease;
      }

      button:hover {
        background: #1e293b;
      }

      button:active {
        transform: translateY(1px);
      }

      button:focus-visible {
        outline: 2px solid #0d9488;
        outline-offset: 3px;
      }

      @media (max-width: 24rem) {
        .page-shell {
          padding: 1rem;
        }

        .password-card {
          border-radius: 1.5rem;
          padding: 1.5rem;
        }
      }
    </style>
  </head>
  <body>
    <main class="page-shell">
      <section class="password-card" aria-labelledby="page-title">
        <p class="eyebrow">LINKFOLD</p>
        <h1 id="page-title">此短網址需要密碼</h1>
        <p class="description">輸入密碼以繼續前往目的頁面。</p>
        <form method="post" action="/${shortCode}/unlock" enctype="application/x-www-form-urlencoded">
          <label for="password">密碼</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required>
          ${errorMarkup}
          <button type="submit">前往連結</button>
        </form>
      </section>
    </main>
  </body>
</html>`;
}

function sendPasswordForm(res, shortCode, status, errorMessage) {
  res
    .status(status)
    .type('html')
    .send(passwordForm(shortCode, errorMessage));
}

router.get('/:code', async (req, res, next) => {
  try {
    const link = await prisma.link.findUnique({
      where: { shortCode: req.params.code },
    });

    if (!link || !link.isEnabled) {
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

    if (!link || !link.isEnabled) {
      throw notFoundError();
    }

    const passwordIsValid =
      typeof req.body.password === 'string' &&
      link.passwordHash !== null &&
      (await verifyPassword(req.body.password, link.passwordHash));

    if (!passwordIsValid) {
      sendPasswordForm(
        res,
        link.shortCode,
        401,
        '密碼錯誤，請再試一次。',
      );
      return;
    }

    res.status(302).set('Location', link.originalUrl).end();
  } catch (error) {
    next(error);
  }
});

export default router;
