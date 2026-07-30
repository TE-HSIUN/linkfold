## 1. 部署合約驗證

- [x] 1.1 先建立會失敗的 scripts/verify-production-deployment.sh，覆蓋 Start the production stack reproducibly、Keep internal services private、Keep production secrets outside version control 的可觀察合約：必要檔案存在、缺少 POSTGRES_PASSWORD 時 config 失敗、只有 port 80 對 host 發布、實際 .env.production 被忽略；以 bash scripts/verify-production-deployment.sh 因缺少第一個 production 檔案而失敗完成 RED，完整 GREEN 留待 Task 4.2 驗證。

## 2. 應用程式映像與路由

- [x] 2.1 依「使用三服務單機架構」與「後端啟動前執行 migration」建立 backend/Dockerfile、backend/.dockerignore、backend/docker-entrypoint.sh，交付 Apply database migrations before serving API traffic：容器依序產生 Prisma Client、執行 prisma migrate deploy、最後啟動 Express，任一步驟失敗即非零退出；以 docker build、entrypoint 內容測試與既有 backend npm test 驗證。
- [x] 2.2 依「Nginx 先代理動態路由再套用 SPA fallback」建立 frontend/Dockerfile、frontend/.dockerignore、frontend/nginx.conf，交付 Serve frontend and dynamic routes from one origin：Vue production build 由 Nginx 提供，/api/、/health、/:code、/:code/unlock 先代理 backend，其他路徑才走 SPA fallback；以 frontend npm test、npm run lint、npm run build、docker build 與 nginx -t 驗證。

## 3. Production Compose 與設定

- [x] 3.1 依「使用獨立的 production Compose」與「使用健康檢查與 restart policy」建立 docker-compose.prod.yml，交付 Start the production stack reproducibly、Keep internal services private、Persist database data、Report production health and recover after restart：db、backend、web 具備 health dependency、named volume、restart: unless-stopped，且只有 web 發布 80:80；以提供測試環境值的 docker compose config 及 scripts/verify-production-deployment.sh 驗證。
- [x] 3.2 依「使用環境檔注入秘密與公開網址」建立 .env.production.example 並更新 .gitignore，交付 Keep production secrets outside version control：範本列出 URL-safe POSTGRES_PASSWORD 與 BASE_URL，實際 .env.production 不被 Git 追蹤，Compose 缺少秘密時拒絕解析；以 git check-ignore、缺值 config failure 與驗證腳本確認。

## 4. 操作文件與端到端驗證

- [x] 4.1 更新 README.md 交付 Document production operations：從乾淨 Ubuntu VM 說明 clone、建立 .env.production、build/up、ps、health、logs、pull/rebuild、down 保留 volume 及禁止誤用 down -v，並明確標記目前只有 HTTP；以逐條文件內容審查及在測試環境執行所有非破壞性指令驗證。
- [x] 4.2 執行完整驗證並記錄結果：bash scripts/verify-production-deployment.sh、backend npm test、frontend npm test、npm run lint、npm run build、兩個 image build、spectra validate add-gcp-production-deployment 與 git diff --check 均通過，確認所有 production-deployment scenarios 有對應證據且沒有超出網域、HTTPS、CI/CD 或備份的範圍。
