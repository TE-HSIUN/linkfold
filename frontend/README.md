# Linkfold 前端

Vue 3、Vite 與 Tailwind CSS 實作的短網址建立頁。頁面位於 `/`，提供原始網址、
自訂短碼、密碼、備註、頁面資訊預填、啟用狀態、建立結果與複製回饋。

## 本機啟動

先依 [`../backend/README.md`](../backend/README.md) 啟動 PostgreSQL、套用
Prisma migration，並讓 Express 運行在 `http://localhost:3000`。

在另一個終端機安裝前端相依套件並啟動 Vite：

```bash
cd frontend
npm ci
npm run dev
```

前端預設位於 `http://localhost:5173`。Axios 使用相對 `/api`，Vite 會將
`/api` proxy 到 `http://localhost:3000`，因此本機不需要修改後端 CORS。
後端回傳的短網址仍由後端 `.env` 的 `BASE_URL` 決定。

若是第一次完整啟動，建議順序如下：

```bash
# 專案根目錄
docker compose up -d

# backend/
npm ci
cp .env.example .env
npx prisma migrate deploy
npm run dev

# 另一個終端機，frontend/
npm ci
npm run dev
```

## 功能邊界

- 自訂短碼只接受 4–32 個小寫英數或連字號，且不可為 `api`、`health`。
- metadata 只有在原始網址通過前端 URL 驗證後才能取得。
- metadata 會以「標題、換行、說明」組成最多 500 字的備註；既有備註不會被自動覆蓋。
- metadata 失敗不會清空表單，也不會阻止建立短網址。
- 停用結果可以複製，但不能開啟；本 MVP 沒有重新啟用介面。
- 受密碼保護短網址的解鎖頁仍由 Express 產生，不屬於 Vue SPA。

## 驗證

```bash
npm test
npm run lint
npm run build
```

測試使用 Vitest、Vue Test Utils 與 mocked API；不需啟動後端。`build` 會輸出
production 靜態檔至 `frontend/dist/`。

## 生產環境路由

生產環境應由同一個公開 origin 提供 `frontend/dist/` 與 Express。Nginx
必須先把下列路由交給 Express，最後才使用 Vue SPA fallback：

1. `/api/`
2. `/health`
3. `/:code/unlock`
4. 符合自動或自訂短碼格式的單層 `/:code`
5. Vue 靜態檔與 `try_files ... /index.html`

若先執行 SPA fallback，短碼 GET 或 unlock 會被 Vue 的 `index.html` 吃掉。
本 change 只記錄代理契約，不新增正式 Nginx、TLS 或雲端部署設定。
