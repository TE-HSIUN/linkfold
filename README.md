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

## GCP VM 部署

Production 架構在單台 Compute Engine VM 上執行三個容器：

- `web`：Nginx 提供 Vue 靜態檔並反向代理動態請求。
- `backend`：Express API、短碼轉址與 Prisma migration。
- `db`：PostgreSQL 15，資料保存在 Docker named volume。

只有 Nginx 的 port 80 會對主機公開；PostgreSQL 5432 與 Express 3000
只存在於 Compose 內部網路。目前僅提供 HTTP，尚未設定網域與 HTTPS，
因此不應在正式公開宣傳前傳輸敏感資料。

### 環境需求

VM 需先安裝 Git、Docker Engine 與 Docker Compose v2，並允許 HTTP
流量。第一次部署時下載 repository：

```bash
git clone https://github.com/TE-HSIUN/linkfold.git
cd linkfold
```

### 1. 建立正式環境設定

複製可提交的範本；實際 `.env.production` 已被 Git 忽略：

```bash
cp .env.production.example .env.production
```

產生 32 bytes、只含十六進位字元的隨機資料庫密碼：

```bash
openssl rand -hex 32
```

使用文字編輯器開啟 `.env.production`，將輸出貼到
`POSTGRES_PASSWORD=` 後方。首次 GCP 部署的 `BASE_URL` 為：

```dotenv
BASE_URL=http://34.122.24.161
```

不要提交 `.env.production`，也不要將密碼貼到 issue、PR 或聊天訊息。

### 2. 檢查並啟動服務

先解析 Compose，確認必要變數與設定有效；這一步不會啟動容器：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config
```

建置 images，並在背景啟動 PostgreSQL、Express 與 Nginx：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Backend 啟動時會先執行 `prisma generate` 與 `prisma migrate deploy`，
成功後才啟動 Express。

### 3. 驗證部署

查看三個服務的狀態：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

在 VM 內檢查經過 Nginx 代理的健康端點與首頁：

```bash
curl -i http://127.0.0.1/health
curl -I http://127.0.0.1/
```

健康端點應回 HTTP 200 與 `{"status":"ok"}`。接著可從瀏覽器開啟
`http://34.122.24.161/`。

若服務未正常啟動，查看最近 100 行 logs：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100
```

持續追蹤 logs 時加上 `--follow`，按 `Ctrl+C` 只會停止追蹤，不會停止
容器：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --follow --tail=100
```

### 更新部署

取得目前 branch 的最新程式碼：

```bash
git pull --ff-only
```

重新建置並套用更新；PostgreSQL named volume 會保留：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

更新後再次執行 `ps`、健康檢查與首頁檢查。

### 停止與復原

停止並移除容器與網路，但保留 PostgreSQL named volume：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

再次執行 `up -d --build` 即可使用原有資料重新啟動。

> 請勿執行 `docker compose down -v` 或在上述指令加入 `down -v`。
> `-v` 會刪除 PostgreSQL named volume，可能造成所有短網址資料永久遺失；
> 只有在明確要清空資料且已確認備份時才能使用。
