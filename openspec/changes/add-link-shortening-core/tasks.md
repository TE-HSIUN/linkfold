## 1. 可執行的 Express server 與健康檢查

- [x] 1.1 依 design 的「將 Express app 與 server 啟動分離」建立後端骨架：`backend/src/app.js` 匯出已註冊 JSON 解析中介層與 `GET /health` 的 Express app，`backend/index.js` 只讀取 `PORT` 並呼叫 `app.listen()`。完成後服務可啟動且滿足 Report service health（`GET /health` 回 200 與 `{"status":"ok"}`）。驗證：執行 `node index.js`，`curl -i http://localhost:3000/health` 回 `200` 且主體為 `{"status":"ok"}`。

## 2. 本機 PostgreSQL 與環境變數

- [ ] 2.1 依 design 的「本機 PostgreSQL 以 Docker Compose 提供」，在專案根目錄新增 `docker-compose.yml`，定義 PostgreSQL 15 服務、對外映射 5432、以具名 volume 持久化資料。完成後開發者只需 Docker 即可取得可連線的資料庫。驗證：`docker compose up -d` 後 `docker compose ps` 顯示服務為 running，且 `docker compose exec db psql -U postgres -c "select 1"` 成功回應。
- [ ] 2.2 建立環境變數契約：`backend/.env.example` 列出 `DATABASE_URL`、`PORT`、`BASE_URL` 三個變數與可直接使用的本機預設值，`.gitignore` 排除 `backend/.env`。完成後任何人複製 `.env.example` 成 `.env` 即可啟動，且真實憑證不會進版控。驗證：建立 `backend/.env` 後執行 `git status --short`，輸出不含 `backend/.env`。

## 3. Link 資料模型與第一支 migration

- [ ] 3.1 依 design 的「資料模型：Link 資料表」在 `backend/prisma/schema.prisma` 定義 `Link` 模型（`id` 自增主鍵、`shortCode` 唯一字串、`originalUrl` 字串、`createdAt` 預設 `now()`），並產生第一支 migration。完成後資料庫具備儲存短網址所需的結構與唯一性保證。驗證：執行 `npx prisma migrate dev --name init_link`，再以 `docker compose exec db psql -U postgres -c '\d "Link"'` 確認四個欄位存在且 `shortCode` 有唯一索引。
- [ ] 3.2 建立 Prisma client 單例 `backend/src/lib/prisma.js` 並匯出，讓路由與測試共用同一個連線池而非各自建立。完成後應用程式可對 `Link` 資料表讀寫。驗證：執行 `node --input-type=module -e "import p from './src/lib/prisma.js'; console.log(await p.link.count())"`，輸出 `0` 且無連線錯誤。

## 4. 測試框架與短碼產生器

- [ ] 4.1 依 design 的「測試策略：node:test 搭配 supertest」導入測試：安裝 `supertest` 為開發相依，並將 `backend/package.json` 的 `test` script 由錯誤佔位改為 `node --test`。完成後 `npm test` 是一個真正會執行測試並回報結果的指令。驗證：於 `backend/` 執行 `npm test`，輸出為測試執行摘要而非 `Error: no test specified`。
- [ ] 4.2 先寫測試：`backend/test/short-code.test.js` 覆蓋 Short codes are unique and randomly generated 的三個情境——回傳長度為 7、字元僅來自 `0-9A-Za-z`、連續產生 1000 次無重複。完成後短碼產生器的契約已被測試釘住。驗證：執行 `npm test`，該檔因產生器尚未實作而失敗（TDD 紅燈）。
- [ ] 4.3 依 design 的「以 node:crypto 自行實作短碼產生器，不引入 nanoid」，在 `backend/src/lib/short-code.js` 實作並匯出 `generateShortCode(length = 7)`，以 `crypto.randomInt` 從 62 字元字母表取值。完成後可穩定產生符合契約的短碼。驗證：執行 `npm test`，4.2 的三個測試全部轉綠。

## 5. 建立短網址 API

- [ ] 5.1 先寫測試：`backend/test/links.test.js` 以 supertest 覆蓋 Create a short link from an original URL（合法網址回 201、`shortCode` 為 7 碼、`shortUrl` 以短碼結尾、同一網址兩次請求得到不同短碼）與 Reject invalid original URLs（缺欄位、空字串、`not-a-url`、`javascript:alert(1)`、非字串各回 400 且 `error.code` 為 `INVALID_URL`）。驗證：執行 `npm test`，該檔因路由尚未存在而失敗（TDD 紅燈）。
- [ ] 5.2 依 design 的「網址驗證使用 WHATWG URL 並限定 http/https」，在 `backend/src/routes/links.js` 加入輸入驗證，並在 `app.js` 註冊統一的 Express 錯誤處理中介層，使所有錯誤回應為 `{"error":{"code","message"}}` 形狀。完成後不合法的網址一律被擋在寫入資料庫之前。驗證：執行 `npm test`，`links.test.js` 中所有 400 案例轉綠，且資料庫 `Link` 筆數未因這些請求增加。
- [ ] 5.3 依 design 的「短碼唯一性靠資料庫唯一約束加重試」完成 `POST /api/links`：產生短碼後寫入，遇 Prisma `P2002` 唯一約束衝突則重新產生並重試，最多 5 次，全數失敗回 500 `INTERNAL_ERROR`；成功時回 201 與 `shortCode`、`shortUrl`、`originalUrl`、`createdAt`。驗證：執行 `npm test`，`links.test.js` 全綠。

## 6. 短碼轉址

- [ ] 6.1 先寫測試：`backend/test/redirect.test.js` 覆蓋 Redirect a short code to its original URL（先建立再造訪，回 302 且 `Location` 等於原始網址）、Unknown short codes return not found（造訪 `/zzzzzzz` 回 404 且 `error.code` 為 `NOT_FOUND`）、Redirect route does not shadow reserved paths（`GET /health` 仍回 200）。驗證：執行 `npm test`，該檔因轉址路由尚未存在而失敗（TDD 紅燈）。
- [ ] 6.2 依 design 的「轉址路由註冊在最後，避免遮蔽既有路徑」，在 `backend/src/routes/redirect.js` 實作 `GET /:code` 並於 `app.js` 中最後註冊：查到資料回 302 並帶 `Location`，查無資料回 404。完成後短網址可在瀏覽器實際跳轉。驗證：執行 `npm test`，`redirect.test.js` 全綠且 `/health` 測試仍為 200。

## 7. 端到端驗證與收尾

- [ ] 7.1 讓整合測試可重複執行且不留殘留資料：`links.test.js` 與 `redirect.test.js` 在 `after` 鉤子刪除自己建立的 `Link` 資料列，並以隨機網址避免測試間互相影響。驗證：連續執行 `npm test` 兩次皆全綠，且事後 `docker compose exec db psql -U postgres -c 'select count(*) from "Link"'` 的筆數與測試前相同。
- [ ] 7.2 撰寫 `backend/README.md` 記錄啟動步驟（複製 `.env.example`、`docker compose up -d`、`npx prisma migrate dev`、`npm run dev`、`npm test`），並照著該步驟從乾淨狀態做一次手動端到端驗證。驗證：依 README 操作後，`curl -X POST localhost:3000/api/links -H 'content-type: application/json' -d '{"originalUrl":"https://example.com"}'` 回 201，`curl -I localhost:3000/<回傳的短碼>` 回 302 且 `Location` 為 `https://example.com`，`curl -i localhost:3000/zzzzzzz` 回 404。
