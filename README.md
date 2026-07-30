# Linkfold

Linkfold 是一個全端縮網址專案，可建立自訂短碼、備註與密碼保護的短網址，
也支援建立時停用連結，以及擷取目標頁面的標題與描述來預填備註。

## 功能

- 建立自動產生或自訂短碼的短網址
- 設定備註與密碼保護
- 建立時設定連結為啟用或停用
- 擷取公開網頁的標題與描述
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

## 專案結構

```text
linkfold/
├── backend/           # Express API、Prisma 與後端測試
├── frontend/          # Vue 3 前端與元件測試
├── openspec/          # Spectra 規格與歷史變更
└── docker-compose.yml # 本機 PostgreSQL
```

## 本機開發

### 環境需求

- Node.js 與 npm
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

本機環境變數範例：

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
PORT=3000
BASE_URL=http://localhost:3000
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

## 部署規劃

預計使用以下架構部署：

- **Google Cloud Platform（GCP）**：雲端平台
- **Compute Engine**：建立雲端虛擬伺服器
- **Ubuntu 24.04 LTS**：伺服器作業系統
- **Docker**：將應用程式與服務容器化
- **Docker Compose**：管理前端、後端、PostgreSQL 與 Nginx 容器
- **Nginx**：提供前端靜態檔案、反向代理 API，並處理網域與 HTTPS

正式環境應由同一個公開 origin 提供 Vue 靜態檔與 Express 服務。Nginx
必須先將 `/api/`、`/health`、`/:code/unlock` 與短碼 `/:code` 交給
Express，最後才套用 Vue SPA fallback。

目前 repository 尚未包含正式環境所需的前端、後端與 Nginx Dockerfile、
完整 production Compose、Nginx 設定及 TLS 設定；現有
`docker-compose.yml` 僅供本機啟動 PostgreSQL。
