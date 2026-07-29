import express from 'express';

const app = express();

// 解析 JSON 請求主體
app.use(express.json());

// 健康檢查
// 注意：轉址路由 GET /:code 是萬用路由，會匹配任何單層路徑，
// 因此所有具名路由都必須註冊在它之前，否則會被吃掉。
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
