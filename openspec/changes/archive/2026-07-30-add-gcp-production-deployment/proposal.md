## Why

Linkfold 已建立 GCP Compute Engine VM，但 repository 目前只有本機 PostgreSQL Compose，無法在伺服器上以單一指令啟動前端、後端、資料庫與反向代理。現在需要一套可重現且可驗證的正式環境容器設定，讓現有靜態 IP 能實際提供 Linkfold 服務。

## What Changes

- 新增 Express 後端的 production image，安裝正式依賴、產生 Prisma Client，並在啟動時套用既有 migrations。
- 新增 Vue production build 與 Nginx image，由同一個公開 origin 提供靜態頁面並反向代理 API、健康檢查、短碼轉址與解鎖請求。
- 新增 production Docker Compose，管理 PostgreSQL、後端與 Nginx，包含持久化 volume、健康檢查、啟動相依性與重新啟動政策。
- 新增可提交的正式環境變數範本，將資料庫密碼與公開 BASE_URL 留給部署者設定，不提交實際秘密。
- 更新 README，記錄 GCP VM 從 clone、設定環境變數、啟動、migration、健康檢查到停止服務的操作方式。

## Capabilities

### New Capabilities

- `production-deployment`: 定義 Linkfold 透過 Docker Compose 在單一 GCP VM 上安全啟動、路由、持久化及驗證的正式部署行為。

### Modified Capabilities

(none)

## Impact

- Affected specs: production-deployment
- Affected code:
  - New: backend/Dockerfile, backend/.dockerignore, backend/docker-entrypoint.sh, frontend/Dockerfile, frontend/.dockerignore, frontend/nginx.conf, docker-compose.prod.yml, .env.production.example, scripts/verify-production-deployment.sh
  - Modified: README.md, .gitignore
  - Removed: none
- Affected systems: GCP Compute Engine VM、Docker Engine、Docker Compose、PostgreSQL 15、Nginx
- API compatibility: 現有前端與後端 API contract 不變；production traffic 改由 Nginx 的單一公開 origin 對外提供
