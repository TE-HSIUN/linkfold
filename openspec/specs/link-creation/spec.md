# link-creation Specification

## Purpose

TBD - created by archiving change 'add-link-shortening-core'. Update Purpose after archive.

## Requirements

### Requirement: Create a short link from an original URL

The system SHALL expose `POST /api/links`, which accepts a JSON body containing an `originalUrl` field and optional `note`, `password`, `shortCode`, and `enabled` fields, selects or generates a unique short code, and persists the link. When `password` is present, the system SHALL first transform its UTF-8 bytes with SHA-256 and Base64 encoding, then store only a bcrypt hash produced from that fixed-length value with cost factor 12. The system SHALL NOT persist the plaintext password or intermediate digest. When `enabled` is omitted, the system SHALL persist the link as enabled.

The response status SHALL be `201 Created` and the response body SHALL contain `shortCode`, `shortUrl`, `originalUrl`, `note`, `passwordProtected`, `enabled`, and `createdAt`. The `shortUrl` SHALL be the configured base URL joined with the selected or generated short code. The response SHALL NOT contain `password` or `passwordHash`.

#### Scenario: Valid URL is shortened

- **WHEN** a client sends `POST /api/links` with body `{"originalUrl": "https://example.com/a/very/long/path"}`
- **THEN** the system responds `201` with a body whose `originalUrl` equals the submitted URL, whose `shortCode` is a generated 7-character alphanumeric string, whose `shortUrl` ends with that short code, whose `note` is null, whose `passwordProtected` is false, and whose `enabled` is true

##### Example: successful creation

- **GIVEN** the configured base URL is `http://localhost:3000`
- **WHEN** the client submits `{"originalUrl": "https://example.com/docs"}`
- **THEN** the response is `201` with `shortCode` = `aB3xY9z`, `shortUrl` = `http://localhost:3000/aB3xY9z`, `originalUrl` = `https://example.com/docs`, `note` = null, `passwordProtected` = false, `enabled` = true, and a `createdAt` ISO-8601 timestamp

#### Scenario: Optional note and password are stored safely

- **WHEN** a client submits `{"originalUrl":"https://example.com/private","note":"Project draft","password":"correct-horse"}` to `POST /api/links`
- **THEN** the system persists the note and a SHA-256-preprocessed bcrypt cost-12 hash that the password helper verifies for `correct-horse`, responds `201` with `note` = `Project draft`, `passwordProtected` = true, and `enabled` = true, and omits `password`, the intermediate digest, and `passwordHash` from the response

#### Scenario: Custom code and disabled state are persisted

- **WHEN** a client submits `{"originalUrl":"https://example.com/draft","shortCode":"project-draft","enabled":false}`
- **THEN** the system responds `201` with `shortCode` = `project-draft`, a `shortUrl` ending in `/project-draft`, and `enabled` = false, and storage contains the same short code and disabled state

#### Scenario: Each automatic request produces a distinct short code

- **WHEN** a client submits the same `originalUrl` twice without a `shortCode` in two separate requests
- **THEN** the system responds `201` both times and the two responses carry different generated `shortCode` values


<!-- @trace
source: add-link-creation-web-ui
updated: 2026-07-30
code:
  - frontend/src/style.css
  - frontend/src/App.vue
  - backend/src/routes/redirect.js
  - backend/src/routes/links.js
  - backend/src/routes/page-metadata.js
  - backend/prisma/migrations/20260729090908_add_link_enabled/migration.sql
  - backend/README.md
  - frontend/src/router/index.js
  - frontend/index.html
  - frontend/eslint.config.js
  - backend/index.js
  - frontend/src/services/api.js
  - backend/src/lib/page-metadata.js
  - frontend/src/components/LinkCreationForm.vue
  - frontend/src/components/LinkResultCard.vue
  - backend/src/app.js
  - frontend/src/main.js
  - frontend/package.json
  - frontend/README.md
  - frontend/src/views/CreateLinkView.vue
  - backend/package.json
  - frontend/vite.config.js
  - backend/prisma/schema.prisma
tests:
  - backend/test/page-metadata.test.js
  - frontend/src/__tests__/CreateLinkView.test.js
  - backend/test/links.test.js
  - backend/test/redirect.test.js
-->

---
### Requirement: Reject invalid original URLs

The system SHALL validate `originalUrl` before persisting it. The value MUST be a string that parses as an absolute URL and whose scheme is `http` or `https`. Any other value SHALL be rejected with status `400` and SHALL NOT be persisted.

#### Scenario: Invalid input is rejected

- **WHEN** a client sends `POST /api/links` with an `originalUrl` that is missing, not a string, unparseable as a URL, or uses a scheme other than http/https
- **THEN** the system responds `400` with an error body whose `error.code` is `INVALID_URL`, and no record is written to storage

##### Example: rejected inputs

| Request body | Expected status | error.code | Notes |
| ------------ | --------------- | ---------- | ----- |
| `{}` | 400 | INVALID_URL | field missing |
| `{"originalUrl": ""}` | 400 | INVALID_URL | empty string |
| `{"originalUrl": "not-a-url"}` | 400 | INVALID_URL | not absolute |
| `{"originalUrl": "javascript:alert(1)"}` | 400 | INVALID_URL | disallowed scheme |
| `{"originalUrl": 42}` | 400 | INVALID_URL | not a string |
| `{"originalUrl": "http://example.com"}` | 201 | — | accepted |


<!-- @trace
source: add-link-shortening-core
updated: 2026-07-29
code:
  - backend/src/lib/password.js
  - backend/README.md
  - .spectra.yaml
  - backend/package.json
  - backend/src/app.js
  - backend/prisma/schema.prisma
  - backend/src/lib/prisma.js
  - backend/.env.example
  - backend/prisma/migrations/20260729042433_add_link_note_password_hash/migration.sql
  - .prettierrc
  - backend/src/lib/short-code.js
  - backend/prisma/migrations/migration_lock.toml
  - backend/src/routes/redirect.js
  - backend/index.js
  - backend/prisma/migrations/20260729033313_init_link/migration.sql
  - docker-compose.yml
  - backend/src/routes/links.js
tests:
  - backend/test/redirect.test.js
  - backend/test/short-code.test.js
  - backend/test/links.test.js
  - backend/test/password.test.js
-->

---
### Requirement: Validate optional note and password

When `note` is present, it MUST be a string no longer than 500 characters. When `password` is present, it MUST be a string between 8 and 128 characters inclusive. An omitted field SHALL mean the corresponding option is not configured. Invalid optional fields SHALL produce status `400` and SHALL NOT persist a record.

#### Scenario: Invalid optional input is rejected

- **WHEN** a client sends `POST /api/links` with a non-string or over-500-character `note`, or with a non-string password or a password outside the inclusive 8–128 character range
- **THEN** the system responds `400` with `error.code` = `INVALID_NOTE` for an invalid note or `INVALID_PASSWORD` for an invalid password, and no record is written to storage

##### Example: optional field boundaries

| Request addition | Expected status | error.code | Notes |
| ---------------- | --------------- | ---------- | ----- |
| no `note` and no `password` | 201 | — | both options omitted |
| `"note": ""` | 201 | — | empty note is a valid string |
| `"note"` with 500 characters | 201 | — | maximum note length |
| `"note"` with 501 characters | 400 | INVALID_NOTE | note too long |
| `"note": 42` | 400 | INVALID_NOTE | note is not a string |
| `"password": "12345678"` | 201 | — | minimum password length |
| `"password"` with 128 characters | 201 | — | maximum password length |
| `"password": "1234567"` | 400 | INVALID_PASSWORD | password too short |
| `"password"` with 129 characters | 400 | INVALID_PASSWORD | password too long |
| `"password": null` | 400 | INVALID_PASSWORD | password is not a string |


<!-- @trace
source: add-link-shortening-core
updated: 2026-07-29
code:
  - backend/src/lib/password.js
  - backend/README.md
  - .spectra.yaml
  - backend/package.json
  - backend/src/app.js
  - backend/prisma/schema.prisma
  - backend/src/lib/prisma.js
  - backend/.env.example
  - backend/prisma/migrations/20260729042433_add_link_note_password_hash/migration.sql
  - .prettierrc
  - backend/src/lib/short-code.js
  - backend/prisma/migrations/migration_lock.toml
  - backend/src/routes/redirect.js
  - backend/index.js
  - backend/prisma/migrations/20260729033313_init_link/migration.sql
  - docker-compose.yml
  - backend/src/routes/links.js
tests:
  - backend/test/redirect.test.js
  - backend/test/short-code.test.js
  - backend/test/links.test.js
  - backend/test/password.test.js
-->

---
### Requirement: Short codes are unique and randomly generated

The system SHALL generate each short code as a 7-character string drawn from the alphabet `0-9`, `A-Z`, `a-z` using a cryptographically secure random source. Storage SHALL enforce uniqueness of short codes. When a generated code collides with an existing one, the system SHALL generate a new code and retry, up to 5 attempts, before responding `500`.

#### Scenario: Generated code matches the required shape

- **WHEN** the short code generator is invoked with no arguments
- **THEN** it returns a 7-character string containing only characters from `0-9A-Za-z`

#### Scenario: Collision is resolved by retrying

- **WHEN** a generated short code already exists in storage and a subsequent generation attempt produces an unused code
- **THEN** the system persists the record with the unused code and responds `201`

#### Scenario: Persistent collision surfaces as a server error

- **WHEN** 5 consecutive generation attempts all collide with existing short codes
- **THEN** the system responds `500` with an error body whose `error.code` is `INTERNAL_ERROR`


<!-- @trace
source: add-link-shortening-core
updated: 2026-07-29
code:
  - backend/src/lib/password.js
  - backend/README.md
  - .spectra.yaml
  - backend/package.json
  - backend/src/app.js
  - backend/prisma/schema.prisma
  - backend/src/lib/prisma.js
  - backend/.env.example
  - backend/prisma/migrations/20260729042433_add_link_note_password_hash/migration.sql
  - .prettierrc
  - backend/src/lib/short-code.js
  - backend/prisma/migrations/migration_lock.toml
  - backend/src/routes/redirect.js
  - backend/index.js
  - backend/prisma/migrations/20260729033313_init_link/migration.sql
  - docker-compose.yml
  - backend/src/routes/links.js
tests:
  - backend/test/redirect.test.js
  - backend/test/short-code.test.js
  - backend/test/links.test.js
  - backend/test/password.test.js
-->

---
### Requirement: Report service health

The system SHALL expose `GET /health`, which responds `200` with body `{"status": "ok"}` and SHALL NOT be shadowed by the short-code redirect route.

#### Scenario: Health check succeeds

- **WHEN** a client sends `GET /health`
- **THEN** the system responds `200` with body `{"status": "ok"}`

<!-- @trace
source: add-link-shortening-core
updated: 2026-07-29
code:
  - backend/src/lib/password.js
  - backend/README.md
  - .spectra.yaml
  - backend/package.json
  - backend/src/app.js
  - backend/prisma/schema.prisma
  - backend/src/lib/prisma.js
  - backend/.env.example
  - backend/prisma/migrations/20260729042433_add_link_note_password_hash/migration.sql
  - .prettierrc
  - backend/src/lib/short-code.js
  - backend/prisma/migrations/migration_lock.toml
  - backend/src/routes/redirect.js
  - backend/index.js
  - backend/prisma/migrations/20260729033313_init_link/migration.sql
  - docker-compose.yml
  - backend/src/routes/links.js
tests:
  - backend/test/redirect.test.js
  - backend/test/short-code.test.js
  - backend/test/links.test.js
  - backend/test/password.test.js
-->

---
### Requirement: Validate custom short codes

When `shortCode` is present, it MUST be a string containing 4 to 32 lowercase ASCII letters, digits, or hyphens, MUST begin and end with a letter or digit, and MUST NOT equal a reserved top-level route. Invalid custom codes SHALL produce status `400` with `error.code` equal to `INVALID_SHORT_CODE` and SHALL NOT persist a record.

#### Scenario: Valid custom short code is accepted

- **WHEN** a client submits `shortCode` equal to `project-docs-2026`
- **THEN** the link is created with exactly `project-docs-2026`

#### Scenario: Invalid custom short code is rejected

- **WHEN** a client submits a custom code shorter than 4 characters, longer than 32 characters, containing uppercase letters, underscores, spaces, or other symbols, beginning or ending with a hyphen, or equal to a reserved route such as `health`
- **THEN** the system responds `400` with `error.code` equal to `INVALID_SHORT_CODE` and writes no link


<!-- @trace
source: add-link-creation-web-ui
updated: 2026-07-30
code:
  - frontend/src/style.css
  - frontend/src/App.vue
  - backend/src/routes/redirect.js
  - backend/src/routes/links.js
  - backend/src/routes/page-metadata.js
  - backend/prisma/migrations/20260729090908_add_link_enabled/migration.sql
  - backend/README.md
  - frontend/src/router/index.js
  - frontend/index.html
  - frontend/eslint.config.js
  - backend/index.js
  - frontend/src/services/api.js
  - backend/src/lib/page-metadata.js
  - frontend/src/components/LinkCreationForm.vue
  - frontend/src/components/LinkResultCard.vue
  - backend/src/app.js
  - frontend/src/main.js
  - frontend/package.json
  - frontend/README.md
  - frontend/src/views/CreateLinkView.vue
  - backend/package.json
  - frontend/vite.config.js
  - backend/prisma/schema.prisma
tests:
  - backend/test/page-metadata.test.js
  - frontend/src/__tests__/CreateLinkView.test.js
  - backend/test/links.test.js
  - backend/test/redirect.test.js
-->

---
### Requirement: Reject a conflicting custom short code

The system SHALL preserve the unique short-code constraint. When a requested custom short code already exists, the system SHALL respond status `409` with `error.code` equal to `SHORT_CODE_TAKEN`, SHALL NOT replace the existing link, and SHALL NOT retry with a generated code.

#### Scenario: Requested short code already exists

- **WHEN** storage already contains `shortCode` equal to `project-docs` and a client requests that same custom code
- **THEN** the system responds `409` with `error.code` equal to `SHORT_CODE_TAKEN` and the existing link remains unchanged


<!-- @trace
source: add-link-creation-web-ui
updated: 2026-07-30
code:
  - frontend/src/style.css
  - frontend/src/App.vue
  - backend/src/routes/redirect.js
  - backend/src/routes/links.js
  - backend/src/routes/page-metadata.js
  - backend/prisma/migrations/20260729090908_add_link_enabled/migration.sql
  - backend/README.md
  - frontend/src/router/index.js
  - frontend/index.html
  - frontend/eslint.config.js
  - backend/index.js
  - frontend/src/services/api.js
  - backend/src/lib/page-metadata.js
  - frontend/src/components/LinkCreationForm.vue
  - frontend/src/components/LinkResultCard.vue
  - backend/src/app.js
  - frontend/src/main.js
  - frontend/package.json
  - frontend/README.md
  - frontend/src/views/CreateLinkView.vue
  - backend/package.json
  - frontend/vite.config.js
  - backend/prisma/schema.prisma
tests:
  - backend/test/page-metadata.test.js
  - frontend/src/__tests__/CreateLinkView.test.js
  - backend/test/links.test.js
  - backend/test/redirect.test.js
-->

---
### Requirement: Validate the enabled state

When `enabled` is present, it MUST be a boolean. A missing `enabled` field SHALL mean enabled. Any other value SHALL produce status `400` with `error.code` equal to `INVALID_ENABLED` and SHALL NOT persist a record.

#### Scenario: Explicit disabled state is accepted

- **WHEN** a client submits a valid link with `enabled` equal to false
- **THEN** the system persists and returns `enabled` equal to false

#### Scenario: Non-boolean enabled state is rejected

- **WHEN** a client submits `enabled` equal to `"false"`, `0`, or null
- **THEN** the system responds `400` with `error.code` equal to `INVALID_ENABLED` and writes no link

<!-- @trace
source: add-link-creation-web-ui
updated: 2026-07-30
code:
  - frontend/src/style.css
  - frontend/src/App.vue
  - backend/src/routes/redirect.js
  - backend/src/routes/links.js
  - backend/src/routes/page-metadata.js
  - backend/prisma/migrations/20260729090908_add_link_enabled/migration.sql
  - backend/README.md
  - frontend/src/router/index.js
  - frontend/index.html
  - frontend/eslint.config.js
  - backend/index.js
  - frontend/src/services/api.js
  - backend/src/lib/page-metadata.js
  - frontend/src/components/LinkCreationForm.vue
  - frontend/src/components/LinkResultCard.vue
  - backend/src/app.js
  - frontend/src/main.js
  - frontend/package.json
  - frontend/README.md
  - frontend/src/views/CreateLinkView.vue
  - backend/package.json
  - frontend/vite.config.js
  - backend/prisma/schema.prisma
tests:
  - backend/test/page-metadata.test.js
  - frontend/src/__tests__/CreateLinkView.test.js
  - backend/test/links.test.js
  - backend/test/redirect.test.js
-->