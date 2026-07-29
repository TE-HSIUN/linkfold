## 1. 可執行的 Express server 與健康檢查

- [x] 1.1 依 design 的「將 Express app 與 server 啟動分離」建立後端骨架：`backend/src/app.js` 匯出已註冊 JSON 解析中介層與 `GET /health` 的 Express app，`backend/index.js` 只讀取 `PORT` 並呼叫 `app.listen()`。完成後服務可啟動且滿足 Report service health（`GET /health` 回 200 與 `{"status":"ok"}`）。驗證：執行 `node index.js`，`curl -i http://localhost:3000/health` 回 `200` 且主體為 `{"status":"ok"}`。

## 2. 本機 PostgreSQL 與環境變數

- [x] 2.1 依 design 的「本機 PostgreSQL 以 Docker Compose 提供」，在專案根目錄新增 `docker-compose.yml`，定義 PostgreSQL 15 服務、對外映射 5432、以具名 volume 持久化資料。完成後開發者只需 Docker 即可取得可連線的資料庫。驗證：`docker compose up -d` 後 `docker compose ps` 顯示服務為 running，且 `docker compose exec db psql -U postgres -c "select 1"` 成功回應。
- [x] 2.2 建立環境變數契約：`backend/.env.example` 列出 `DATABASE_URL`、`PORT`、`BASE_URL` 三個變數與可直接使用的本機預設值，`.gitignore` 排除 `backend/.env`。完成後任何人複製 `.env.example` 成 `.env` 即可啟動，且真實憑證不會進版控。驗證：建立 `backend/.env` 後執行 `git status --short`，輸出不含 `backend/.env`。

## 3. Link 資料模型與第一支 migration

- [x] 3.1 依 design 的「資料模型：Link 資料表」在 `backend/prisma/schema.prisma` 定義 `Link` 模型（`id` 自增主鍵、`shortCode` 唯一字串、`originalUrl` 字串、`createdAt` 預設 `now()`），並產生第一支 migration。完成後資料庫具備儲存短網址所需的結構與唯一性保證。驗證：執行 `npx prisma migrate dev --name init_link`，再以 `docker compose exec db psql -U postgres -c '\d "Link"'` 確認四個欄位存在且 `shortCode` 有唯一索引。
- [x] 3.2 建立 Prisma client 單例 `backend/src/lib/prisma.js` 並匯出，讓路由與測試共用同一個連線池而非各自建立。完成後應用程式可對 `Link` 資料表讀寫。驗證：執行 `node --input-type=module -e "import p from './src/lib/prisma.js'; console.log(await p.link.count())"`，輸出 `0` 且無連線錯誤。
- [x] 3.3 延伸 design 的「資料模型：Link 資料表」，在 `backend/prisma/schema.prisma` 為 `Link` 加入 nullable `note` 與 nullable `passwordHash`，並建立 `add_link_note_password_hash` 第二支 migration，不修改已完成的 `init_link` migration。完成後既有資料列可在無回填下升級，且新資料可選填備註與密碼雜湊。驗證：執行 `npx prisma migrate dev --name add_link_note_password_hash`，再以 `docker compose exec db psql -U postgres -c '\d "Link"'` 確認兩欄允許 NULL。

## 4. 測試框架與短碼產生器

- [x] 4.1 依 design 的「測試策略：node:test 搭配 supertest」導入測試：安裝 `supertest` 為開發相依、`bcrypt` 為執行期相依，並將 `backend/package.json` 的 `test` script 由錯誤佔位改為 `node --test`。完成後 `npm test` 是一個真正會執行測試並回報結果的指令，且後端具備密碼雜湊能力。驗證：於 `backend/` 執行 `npm test`，輸出為測試執行摘要而非 `Error: no test specified`，且 `npm ls bcrypt supertest` 無 missing dependency。
- [x] 4.2 先寫測試：`backend/test/short-code.test.js` 覆蓋 Short codes are unique and randomly generated 的三個情境——回傳長度為 7、字元僅來自 `0-9A-Za-z`、連續產生 1000 次無重複。完成後短碼產生器的契約已被測試釘住。驗證：執行 `npm test`，該檔因產生器尚未實作而失敗（TDD 紅燈）。
- [x] 4.3 依 design 的「以 node:crypto 自行實作短碼產生器，不引入 nanoid」，在 `backend/src/lib/short-code.js` 實作並匯出 `generateShortCode(length = 7)`，以 `crypto.randomInt` 從 62 字元字母表取值。完成後可穩定產生符合契約的短碼。驗證：執行 `npm test`，4.2 的三個測試全部轉綠。
- [x] 4.4 先寫 `backend/test/password.test.js`，覆蓋 design 的「密碼使用 bcrypt cost 12 雜湊後保存」：雜湊不等於原文、bcrypt cost 為 12、正確密碼比對成功、錯誤密碼比對失敗，且前 72 bytes 相同但尾端不同的長密碼不可互相通過。完成後密碼 helper 的安全契約已被測試釘住。驗證：執行 `npm test -- test/password.test.js`，測試因 helper 尚未存在而失敗（TDD 紅燈）。
- [x] 4.5 在 `backend/src/lib/password.js` 實作集中式密碼 helper：先將 UTF-8 密碼做 SHA-256 並轉為 Base64，再以 bcrypt cost 12 雜湊或比對，讓完整 8–128 字元輸入都參與驗證，且建立與解鎖路由不直接處理密碼細節。完成後 helper 不輸出或記錄原始密碼、中間摘要及雜湊。驗證：執行 `npm test -- test/password.test.js`，4.4 的測試全部轉綠。

## 5. 建立短網址 API

- [ ] 5.1 先寫測試：`backend/test/links.test.js` 以 supertest 覆蓋 Create a short link from an original URL（有／無選填欄位皆回 201、`shortCode` 為 7 碼、`shortUrl` 以短碼結尾、同一網址兩次得到不同短碼）、Reject invalid original URLs，以及 Validate optional note and password 的 500/501 字元備註與 8/128/129 字元密碼邊界；成功回應只含 `note` 與 `passwordProtected`，不含密碼或雜湊。驗證：執行 `npm test -- test/links.test.js`，測試因路由尚未支援完整契約而失敗（TDD 紅燈）。
- [ ] 5.2 依 design 的「網址驗證使用 WHATWG URL 並限定 http/https」在 `backend/src/routes/links.js` 驗證網址，並驗證選填 `note` 是不超過 500 字元的字串、選填 `password` 是 8–128 字元的字串；在 `app.js` 註冊統一錯誤處理，使失敗分別回 `INVALID_URL`、`INVALID_NOTE`、`INVALID_PASSWORD` 的 400 JSON。完成後所有不合法輸入都在寫入前被拒絕。驗證：執行 `npm test -- test/links.test.js`，所有 400 案例轉綠且資料庫筆數不增加。
- [ ] 5.3 依 design 的「短碼唯一性靠資料庫唯一約束加重試」與「密碼使用 bcrypt cost 12 雜湊後保存」完成 `POST /api/links`：選填密碼先雜湊再寫入，短碼遇 Prisma `P2002` 最多重試 5 次；成功時回 201 與 `shortCode`、`shortUrl`、`originalUrl`、`note`、`passwordProtected`、`createdAt`，且不回傳密碼或 `passwordHash`。驗證：執行 `npm test -- test/links.test.js`，建立、雜湊、碰撞重試與回應資料形狀全部轉綠。

## 6. 短碼轉址

- [ ] 6.1 先寫測試：`backend/test/redirect.test.js` 覆蓋 Redirect a short code to its original URL、Require a password before redirecting protected links（GET 密碼頁、正確 POST 302、錯誤／缺少密碼 POST 401、再次 GET 仍要求密碼且頁面不洩漏備註或原始網址）、Unknown short codes return not found（GET 與 unlock POST 皆 404），以及 Redirect route does not shadow reserved paths。驗證：執行 `npm test -- test/redirect.test.js`，測試因轉址與密碼頁路由尚未完成而失敗（TDD 紅燈）。
- [ ] 6.2 依 design 的「轉址路由註冊在最後，避免遮蔽既有路徑」，在 `backend/src/routes/redirect.js` 實作未受保護的 `GET /:code`，並於 `app.js` 中最後註冊轉址 router；查到無密碼 Link 回 302，查無資料回 404，Report service health 與 API 路徑仍由既有 route 處理。驗證：執行 `npm test -- test/redirect.test.js`，未受保護轉址、404、`/health` 與 `/api/links` 案例轉綠。
- [ ] 6.3 依 design 的「受保護連結使用伺服器產生的密碼頁」，讓 `GET /:code` 對有 `passwordHash` 的 Link 回 200 HTML 表單，並實作 `POST /:code/unlock` 以 bcrypt 比對密碼；正確回 302，錯誤或缺少回 401 表單，未知短碼回 404，所有 HTML 都不含備註、原始網址或雜湊，且不建立 session。驗證：執行 `npm test -- test/redirect.test.js`，Require a password before redirecting protected links 的全部案例轉綠。

## 7. 端到端驗證與收尾

- [ ] 7.1 讓整合測試可重複執行且不留殘留資料：`links.test.js` 與 `redirect.test.js` 在 `after` 鉤子刪除自己建立的未受保護及受保護 Link，並以隨機網址避免測試間互相影響。驗證：連續執行 `npm test` 兩次皆全綠，且事後 `docker compose exec db psql -U postgres -c 'select count(*) from "Link"'` 的筆數與測試前相同。
- [ ] 7.2 撰寫 `backend/README.md` 記錄啟動步驟（複製 `.env.example`、`docker compose up -d`、套用兩支 Prisma migrations、`npm run dev`、`npm test`）及選填欄位限制，並從乾淨狀態驗證兩條流程：無密碼短網址直接 302；含備註與密碼的短網址 GET 回密碼頁、錯誤密碼回 401、正確密碼回 302，且頁面與 API 不洩漏密碼雜湊。驗證：依 README 的 curl 指令逐項取得預期狀態與 `Location`，再執行 `npm test` 全綠。
