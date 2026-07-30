# Linkfold

Linkfold 是練習製作一個全端縮網址專案，可建立自訂短碼、備註與密碼保護的短網址，
也支援建立時選擇是否啟用連結，並可手動擷取目標頁面的標題與描述來預填備註。

## 線上展示

- **公開網址**：[http://34.122.24.161](http://34.122.24.161)
- **部署環境**：Google Cloud Platform（GCP）Compute Engine
- **目前進度**：第一版 MVP 已完成並部署

目前僅提供 HTTP，尚未設定網域與 HTTPS，請勿透過展示環境傳輸敏感資料。

## 開發流程

專案採用 AI 協作與規格驅動的方式開發，流程如下：

1. **討論架構與 MVP 範圍**：先與 AI 討論系統架構、前後端分工及第一版
   MVP 必須完成的核心功能。
2. **建立變更規格**：使用 Spectra 建立 change，將需求、設計與實作任務記錄
   在 `openspec/`。
3. **實作 MVP**：由 AI 依照 Spectra 規格與任務實作功能，並透過測試驗證前端、
   後端與資料庫行為。
4. **Code Review 與功能檢查**：檢查每次變更的程式碼、規格及測試結果，確認功能
   符合預期後再封存變更。
5. **部署第一版 MVP**：將通過驗證的版本部署至 GCP Compute Engine，使用
   Docker Compose 管理 Nginx、Express 與 PostgreSQL。此階段目前已完成。
6. **持續優化**：接下來會進行更詳細的 Code Review，並針對需要改善、修正或
   強化的部分持續建立變更與迭代。

## 功能

- 建立自動產生或自訂短碼的短網址
- 設定備註與密碼保護
- 建立時選擇是否立即啟用連結（目前不支援建立後重新啟用）
- 手動擷取公開網頁的標題與描述來預填備註
- 透過短碼進行一般轉址或密碼解鎖
- 使用統一格式回傳 API 錯誤

## 技術棧

### Frontend

- **Vue 3**：建立前端畫面與互動
- **Vite**：前端開發伺服器與打包工具
- **Tailwind CSS**：頁面樣式設計
- **Axios**：呼叫後端 API
- **Vue Router**：管理前端頁面路由
- **Vitest / Vue Test Utils**：前端元件與流程測試

### Backend

- **Node.js**：執行後端 JavaScript
- **Express**：建立 API、處理請求與短網址轉址
- **Node.js Test Runner / Supertest**：後端單元與整合測試

### Database

- **PostgreSQL**：儲存原始網址、短碼、備註、密碼雜湊與啟用狀態
- **Prisma**：操作資料庫、管理 Schema 與 Migration

### Version Control

- **Git**：管理程式碼版本
- **GitHub**：儲存 Repository，並管理 Issue、Branch 與 Pull Request

### Deployment

- **Docker / Docker Compose**：建置並管理正式環境容器
- **Nginx**：提供 Vue 靜態檔並反向代理動態請求
- **GCP Compute Engine**：執行正式環境服務

## 專案結構

```text
linkfold/
├── backend/                        # Express API、Prisma 與後端測試
├── docs/                           # 部署與維運手冊
├── frontend/                       # Vue 3 前端、Nginx 與元件測試
├── openspec/                       # Spectra 規格與歷史變更
├── scripts/                        # Production 部署合約驗證
├── .env.production.example        # 正式環境變數範本
├── docker-compose.yml              # 本機 PostgreSQL
└── docker-compose.prod.yml         # GCP 正式環境服務
```

## 本機開發

### 環境需求

- Node.js 22.18 以上與 npm
- Docker 與 Docker Compose

### 1. 啟動 PostgreSQL

在專案根目錄執行：

```bash
docker compose up -d
docker compose ps
```

目前的 Docker Compose 僅啟動 PostgreSQL 15，並將資料保存在
`postgres_data` volume。

### 2. 啟動後端

```bash
cd backend
npm ci
cp .env.example .env
npx prisma migrate deploy
npm run dev
```

後端預設位於 `http://localhost:3000`。可使用健康檢查確認服務：

```bash
curl -i http://localhost:3000/health
```

### 3. 啟動前端

開啟另一個終端機：

```bash
cd frontend
npm ci
npm run dev
```

前端預設位於 `http://localhost:5173`。開發環境中的 `/api` 請求會由 Vite
代理到 `http://localhost:3000`。

## 驗證

後端測試需要先啟動本機 PostgreSQL：

```bash
cd backend
npm test
```

前端測試、程式碼檢查與 production build：

```bash
cd frontend
npm test
npm run lint
npm run build
```

更多 API 與功能細節請參考：

- [後端說明](backend/README.md)
- [前端說明](frontend/README.md)

## GCP 部署

第一版 MVP 已部署至 GCP Compute Engine。Production 使用
`docker-compose.prod.yml` 管理三個容器：

- `web`：Nginx 提供 Vue 靜態檔並代理動態請求
- `backend`：Express API、短碼轉址與 Prisma migration
- `db`：PostgreSQL 15，資料保存在 Docker named volume

只有 Nginx 的 port 80 對外公開；backend 與 db 只存在於 Compose 內部網路。
目前尚未設定網域與 HTTPS，請勿透過展示環境傳輸敏感資料。

更新部署：

```bash
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

完整的首次部署、環境設定、健康檢查、logs 與復原步驟請參考
[GCP 部署手冊](docs/gcp-deployment.md)。
