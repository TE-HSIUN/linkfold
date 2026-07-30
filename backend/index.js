import 'dotenv/config';

import app from './src/app.js';

// 只負責啟動 server。app 本身定義在 src/app.js，
// 讓測試可以直接載入 app 而不會佔用連接埠。
const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Linkfold 後端已啟動：http://localhost:${port}`);
});
