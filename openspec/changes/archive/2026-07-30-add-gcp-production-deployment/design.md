## Context

Linkfold 的 GCP Compute Engine VM 已具備 Ubuntu 24.04、Docker、Docker Compose、Git 與固定外部 IPv4。現有 repository 的 docker-compose.yml 只啟動本機開發用 PostgreSQL，前端與後端沒有 production image，也沒有對外提供單一 origin 的反向代理。這次設計服務單台 VM 的 MVP 部署，操作者透過 SSH 管理服務，訪客先以固定 IP 的 HTTP 連線使用系統。

## Goals / Non-Goals

**Goals:**

- 使用一個 production Compose 指令啟動 PostgreSQL、Express 與 Nginx/Vue。
- PostgreSQL 僅在 Compose 內部網路提供服務，資料保存在具名 volume。
- 後端在接受正式流量前完成 Prisma Client 產生與既有 migration 套用。
- Nginx 以 port 80 提供 Vue 靜態檔，並將 API、健康檢查、短碼轉址及解鎖請求代理至 Express。
- 使用可提交的環境變數範本與 README，使第一次部署、更新、驗證及停止服務可重現。

**Non-Goals:**

- 不在此變更中設定網域、TLS 憑證或 HTTPS redirect。
- 不建立 CI/CD、自動 GitHub 部署或容器 registry。
- 不建立高可用、多 VM、負載平衡、受管資料庫或自動異地備份。
- 不改變現有短網址 API、資料模型或 UI 功能。

## Decisions

### 使用獨立的 production Compose

新增 docker-compose.prod.yml，保留現有 docker-compose.yml 作為本機 PostgreSQL 開發環境。Production Compose 明確建立 db、backend、web 三個服務，只有 web 對主機公開 80:80；資料庫與後端不公開主機連接埠。

替代方案是直接改寫現有 Compose，但會破壞 README 已記錄的本機開發流程，因此不採用。

### 使用三服務單機架構

PostgreSQL 使用官方 postgres:15 image；backend 使用 Node 22 Alpine image；web 使用多階段 frontend build 後的 Nginx Alpine image。服務透過 Compose 內部 DNS 使用 db、backend 名稱互連，避免把內部連接埠暴露到公網。

替代方案是在 VM 直接安裝 Node、PostgreSQL 與 Nginx，但版本、升級和復原較難重現，因此不採用。

### 後端啟動前執行 migration

Backend entrypoint 先執行 Prisma Client 產生，再執行 prisma migrate deploy，兩者成功後才啟動 npm start。Backend image 保留執行 Prisma CLI 所需的 npm 依賴，以換取可靠且直接的首次部署與更新流程。任一步驟失敗時容器以非零狀態結束，不讓未完成 migration 的 API 接收流量。

替代方案是在 image build 階段 migration，但 build 時沒有正式資料庫連線，且會把部署副作用混入 image 建置，因此不採用。

### Nginx 先代理動態路由再套用 SPA fallback

Nginx 先處理 /api/、精確 /health、單層短碼 /:code 與 /:code/unlock，再由最後的 location / 使用 try_files 回傳 Vue index.html。代理保留 Host、X-Real-IP、X-Forwarded-For 與 X-Forwarded-Proto；現有 Express API contract 與相對 /api 請求不變。

替代方案是讓 Express 同時提供 frontend dist，但會把靜態檔服務與 API runtime 綁在同一 image，降低前後端 image 的獨立性，因此不採用。

### 使用環境檔注入秘密與公開網址

提交 .env.production.example，只包含安全範例與必填欄位名稱。實際 .env.production 由 VM 操作者建立並由 .gitignore 排除。POSTGRES_PASSWORD 必須使用 URL-safe 隨機值，BASE_URL 在目前階段填固定 IP 的 HTTP origin。Compose 不提供可直接上線的正式密碼預設值。

替代方案是把密碼直接寫進 Compose，會將秘密提交至 Git，因此不採用。

### 使用健康檢查與 restart policy

Database 以 pg_isready 檢查；backend 呼叫 /health；web 透過本機 HTTP 檢查首頁。Backend 等待 database healthy，web 等待 backend healthy。三個服務採 restart: unless-stopped，讓 VM 或 Docker daemon 重啟後自動恢復，但操作者明確停止的服務不會被強制啟動。

## Implementation Contract

**Behavior:** 操作者在 repository 根目錄準備 .env.production 後，執行 docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build，三個服務 SHALL 啟動。訪客開啟 http://34.122.24.161/ SHALL 取得 Vue 頁面；/api/、/health、/:code 與 /:code/unlock 的語意 SHALL 與現有 Express 行為一致。

**Configuration interface:** .env.production SHALL 提供 POSTGRES_PASSWORD 與 BASE_URL。Production Compose SHALL 將 DATABASE_URL 組成指向 db:5432 的 PostgreSQL URL，且 SHALL NOT 將 5432 或 3000 映射至 VM 公開介面。實際 .env.production SHALL 被 Git 忽略。

**Startup and failure modes:** Database 未健康時 backend SHALL NOT 啟動應用程式；Prisma Client 產生或 migration 失敗時 backend SHALL 以非零狀態結束並在 docker compose ps/logs 中呈現失敗。Backend 未健康時 web SHALL NOT 被標記 healthy。Nginx 的 upstream 失敗 SHALL 回傳標準 502，而不是 Vue index.html。

**Acceptance criteria:** docker compose config SHALL 可在提供範例必要值時解析；backend 與 frontend images SHALL 成功 build；既有 backend 測試、frontend 測試、lint 與 build SHALL 通過；production stack 啟動後 curl http://127.0.0.1/health SHALL 回傳 200 與 status ok，首頁 SHALL 回傳 200，且 docker compose ps SHALL 顯示三個服務運行或 healthy。README SHALL 包含首次部署、更新、查看 logs、停止與保留資料的指令。

**Scope boundaries:** 此變更只涵蓋單台 GCP VM 的 HTTP production deployment 與操作文件。網域、HTTPS、憑證續期、CI/CD、外部資料庫與備份策略明確不在範圍內。

## Risks / Trade-offs

- [單台 VM 故障會使整個服務中斷] → 以 restart policy 降低程序層級中斷；高可用留待後續變更。
- [HTTP 會以明文傳輸資料與密碼解鎖表單] → 本階段只用於首次驗證；公開推廣前另行加入網域與 HTTPS。
- [Backend image 保留開發依賴會增加 image 大小] → 優先確保 Prisma migration 可重現；後續可將 migration 拆為一次性 image 或調整 dependency 分類。
- [資料庫與應用位於同一 VM] → PostgreSQL 不公開端口並使用具名 volume；受管資料庫與備份留待後續。
- [單層路徑會被視為短碼] → 符合現有 Express catch-all contract；未來新增 Vue 單層 route 時必須同步調整 Nginx 路由優先順序。

## Migration Plan

1. 在隔離 branch 建立並驗證 images、Compose、Nginx 設定與文件。
2. 經使用者確認後提交並推送至 GitHub。
3. VM 拉取部署 branch，複製環境範本為 .env.production 並填入隨機密碼與固定 IP BASE_URL。
4. 執行 production Compose build/up，確認 migrations、health checks、首頁與公開固定 IP。
5. 若部署失敗，執行 production Compose down 停止新服務但保留 PostgreSQL volume，修正後重新 build/up；不得使用 down -v，除非使用者明確同意刪除資料。

## Open Questions

- 無；網域與 HTTPS 已明確延後至首次 HTTP 部署驗證完成後處理。
