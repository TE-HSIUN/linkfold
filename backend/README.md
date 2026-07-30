# Linkfold 後端

Linkfold 後端提供短網址建立、一般連結轉址，以及共享密碼保護功能。

## 環境需求

- Node.js
- npm
- Docker 與 Docker Compose

## 啟動方式

先在專案根目錄啟動 PostgreSQL：

```bash
docker compose up -d
docker compose ps
```

接著進入後端目錄，安裝相依套件並建立本機環境設定：

```bash
cd backend
npm install
cp .env.example .env
```

`.env.example` 提供可直接使用的本機預設值：

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
PORT=3000
BASE_URL=http://localhost:3000
```

套用所有 migration：

```bash
npx prisma migrate deploy
```

預期會套用：

- `init_link`
- `add_link_note_password_hash`
- `20260729090908_add_link_enabled`

啟動開發伺服器：

```bash
npm run dev
```

服務預設位於 `http://localhost:3000`。可用健康檢查確認：

```bash
curl -i http://localhost:3000/health
```

預期回應 `200 OK` 與：

```json
{"status":"ok"}
```

## 建立短網址

`POST /api/links` 使用 JSON 請求：

- `originalUrl`：必填，必須是 `http` 或 `https` 網址。
- `shortCode`：選填，須為 4–32 個小寫英數或連字號，頭尾不可是連字號，且不可為 `api` 或 `health`。
- `note`：選填，必須是字串，最多 500 字元；空字串有效。
- `password`：選填，必須是 8–128 字元的字串。
- `enabled`：選填，必須是 boolean；省略時預設為 `true`。
- `shortCode`、`note` 或 `password` 只有完全省略時才代表不設定。

### 無密碼短網址

建立短網址並取出短碼：

```bash
UNPROTECTED_RESPONSE=$(curl -sS -X POST http://localhost:3000/api/links \
  -H 'Content-Type: application/json' \
  --data '{"originalUrl":"https://example.com/docs"}')
echo "$UNPROTECTED_RESPONSE"
UNPROTECTED_CODE=$(node -p 'JSON.parse(process.argv[1]).shortCode' "$UNPROTECTED_RESPONSE")
```

成功回應為 `201 Created`，且 JSON 的 `passwordProtected` 為 `false`。造訪短碼：

```bash
curl -i "http://localhost:3000/$UNPROTECTED_CODE"
```

預期回應 `302 Found`、`Location: https://example.com/docs`，且 response body 為空。

### 自訂短碼與停用狀態

自訂短碼不會被伺服器重新命名。若短碼已存在，API 回
`409 SHORT_CODE_TAKEN`：

```bash
curl -i -X POST http://localhost:3000/api/links \
  -H 'Content-Type: application/json' \
  --data '{"originalUrl":"https://example.com/docs","shortCode":"project-docs","enabled":true}'
```

建立停用連結時傳入 `"enabled": false`。停用短碼無論是否有密碼，
`GET /:code` 與 `POST /:code/unlock` 都會和未知短碼相同地回
`404 NOT_FOUND`，不會附帶 `Location` 或顯示密碼表單。本 MVP 沒有重新啟用 API。

### 含備註與密碼的短網址

建立受保護連結並取出短碼：

```bash
PROTECTED_RESPONSE=$(curl -sS -X POST http://localhost:3000/api/links \
  -H 'Content-Type: application/json' \
  --data '{"originalUrl":"https://example.com/private","note":"Project draft","password":"correct-horse"}')
echo "$PROTECTED_RESPONSE"
PROTECTED_CODE=$(node -p 'JSON.parse(process.argv[1]).shortCode' "$PROTECTED_RESPONSE")
```

成功回應為 `201 Created`，`note` 為 `Project draft`，且
`passwordProtected` 為 `true`。JSON 不會包含 `password` 或
`passwordHash`。

造訪受保護連結：

```bash
curl -i "http://localhost:3000/$PROTECTED_CODE"
```

預期回應 `200 OK` 與密碼表單。HTML 不會包含備註、原始網址、明文密碼或
密碼雜湊。

提交錯誤密碼：

```bash
curl -i -X POST "http://localhost:3000/$PROTECTED_CODE/unlock" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'password=wrong-password'
```

預期回應 `401 Unauthorized`，並再次顯示不洩漏連結資料的密碼表單。

提交正確密碼：

```bash
curl -i -X POST "http://localhost:3000/$PROTECTED_CODE/unlock" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'password=correct-horse'
```

預期回應 `302 Found`、`Location: https://example.com/private`，且 response
body 為空。伺服器不會建立解鎖 session；再次造訪短碼仍會顯示密碼表單。

## 取得頁面 metadata

`POST /api/page-metadata` 接受：

```json
{"originalUrl":"https://example.com/docs"}
```

成功回 `200 OK`，且只包含兩個字串欄位：

```json
{"title":"Example Docs","description":"Reference guide"}
```

此 endpoint 不執行頁面 JavaScript，也不抓取圖片或 Open Graph 卡片。為避免
SSRF 與無界工作量，它只允許無 credentials、使用預設 80/443 port 的
HTTP/HTTPS 公開位址；每次 redirect 都重新驗證 DNS，最多三次 redirect，
整條請求共用五秒 deadline，只接受 HTML/XHTML，回應上限為 1 MiB。

不安全或格式錯誤的目標回 `400 INVALID_URL`；DNS、連線、逾時、redirect、
媒體類型或大小問題回 `422 METADATA_UNAVAILABLE`。底層錯誤與遠端內容不會
出現在錯誤回應中。

```bash
curl -i -X POST http://localhost:3000/api/page-metadata \
  -H 'Content-Type: application/json' \
  --data '{"originalUrl":"https://example.com"}'
```

## API 錯誤格式

所有可預期錯誤使用同一外層格式：

```json
{"error":{"code":"INVALID_SHORT_CODE","message":"..."}}
```

建立 API 可能回 `INVALID_URL`、`INVALID_SHORT_CODE`、
`SHORT_CODE_TAKEN`、`INVALID_NOTE`、`INVALID_PASSWORD` 與
`INVALID_ENABLED`。非預期伺服器錯誤只回 `500 INTERNAL_ERROR`，不洩漏
Prisma 或其他內部細節。

## 執行測試

測試會連線本機 PostgreSQL，因此請先確認 Docker Compose 的 `db` 服務正在執行：

```bash
npm test
```

整合測試會使用每次執行專屬的網址，並在結束後刪除本次建立的 Link。

完整驗證：

```bash
npm test
```

前端的啟動、測試與同源代理方式請見
[`../frontend/README.md`](../frontend/README.md)。
