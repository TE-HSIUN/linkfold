## Why

Linkfold 目前只有一個空的 Express 專案骨架，沒有任何可執行的功能。縮網址服務的最小成立條件是「能建立短網址」與「造訪短網址能轉址」這兩件事，缺一項服務就不成立；第一版也需要讓建立者選填備註，並以共享密碼限制訪客轉址。本變更先把這條端到端主線打通並接上真實資料庫，讓後續的點擊統計、前端介面、部署都有穩固的資料模型與程式結構可以疊加。

## What Changes

- 新增 `POST /api/links`：接收原始網址及選填的備註與密碼，驗證格式後產生唯一短碼並存入資料庫；密碼只保存 bcrypt 雜湊，成功時回傳短碼、完整短網址與備註，不回傳密碼或雜湊。
- 新增 `GET /:code`：以短碼查詢原始網址；未受保護的連結直接回 302，受密碼保護的連結回傳伺服器產生的密碼輸入頁，找不到時回 404。
- 新增 `POST /:code/unlock`：驗證受保護連結的共享密碼，正確時回 302 轉址，錯誤時回 401 並重新顯示密碼頁。
- 新增 `GET /health`：回傳服務存活狀態，供本機與後續部署做健康檢查。
- 導入 PostgreSQL 與 Prisma：新增 `Link` 資料表（id、shortCode、originalUrl、選填 note、選填 passwordHash、createdAt），先產生核心欄位的第一支 migration，再以第二支 migration 加入備註與密碼雜湊欄位。
- 新增 Docker Compose 設定，在本機啟動 PostgreSQL 容器；資料庫連線以環境變數 `DATABASE_URL` 提供。
- 導入測試框架（Node.js 內建 `node:test` 搭配 `supertest`），並將 `npm test` 從錯誤佔位改成實際執行測試。
- 將後端程式碼由單一 `backend/index.js` 拆為 `backend/src/` 下的 app、routes、lib 分層，讓 Express app 可被測試直接載入而不需啟動 server。

## Non-Goals

- 不做前端：本變更不建立 `frontend/`，也不寫任何 Vue 程式碼；驗證方式為 curl 與自動化測試。
- 不做點擊次數統計：`Link` 資料表本次不含 clicks 欄位，轉址時不寫入任何統計資料。
- 不做自訂短碼：短碼一律由系統隨機產生，API 不接受使用者指定的短碼。
- 不做有效期限。
- 不做使用者帳號、登入、建立者權限或管理權杖：任何人都可以建立短網址，備註不具私密性保證。
- 不做短網址建立後的備註編輯、密碼修改／移除、刪除或密碼重設。
- 不做解鎖 session；每次造訪受保護的短網址都必須重新輸入密碼。
- 不做正式環境部署：不撰寫 Nginx 設定、不處理網域與 HTTPS、不建立後端的 Dockerfile；Docker Compose 本次只用來跑本機 PostgreSQL。
- 不做速率限制與惡意網址過濾。

## Capabilities

### New Capabilities

- `link-creation`: 建立短網址——原始網址、選填備註與選填密碼的驗證，唯一短碼產生，密碼雜湊與持久化儲存，以及 `POST /api/links` 的請求與回應契約。
- `link-redirection`: 短碼轉址——未受保護連結直接轉址，受保護連結顯示密碼頁並於驗證成功後轉址，以及短碼不存在時回應 404。

### Modified Capabilities

(none)

## Impact

- Affected specs: 新增 `link-creation`、`link-redirection` 兩個 capability。
- Affected code:
  - New:
    - `docker-compose.yml`
    - `backend/.env.example`
    - `backend/prisma/schema.prisma`
    - `backend/src/app.js`
    - `backend/src/lib/prisma.js`
    - `backend/src/lib/password.js`
    - `backend/src/lib/short-code.js`
    - `backend/src/routes/links.js`
    - `backend/src/routes/redirect.js`
    - `backend/test/short-code.test.js`
    - `backend/test/links.test.js`
    - `backend/test/password.test.js`
    - `backend/test/redirect.test.js`
  - Modified:
    - `backend/index.js`
    - `backend/package.json`
    - `.gitignore`
  - Removed: (none)
- Affected dependencies: 新增 `@prisma/client`、`bcrypt`（執行期），以及 `prisma`、`supertest`（開發期）。
- Affected systems: 本機開發需要 Docker 才能啟動 PostgreSQL；整合測試需要資料庫連線可用。
