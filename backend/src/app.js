import express from 'express';

import linksRouter from './routes/links.js';

const app = express();

// 解析 JSON 請求主體
app.use(express.json());

// 健康檢查
// 注意：轉址路由 GET /:code 是萬用路由，會匹配任何單層路徑，
// 因此所有具名路由都必須註冊在它之前，否則會被吃掉。
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/links', linksRouter);

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const status = error.status ?? 500;
  const code = status === 500 ? 'INTERNAL_ERROR' : error.code;
  const message =
    status === 500 ? '伺服器發生錯誤' : error.message;

  if (status === 500) {
    console.error(error);
  }

  res.status(status).json({
    error: {
      code,
      message,
    },
  });
});

export default app;
