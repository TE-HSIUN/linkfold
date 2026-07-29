# link-creation Specification

## Purpose

TBD - created by archiving change 'add-link-shortening-core'. Update Purpose after archive.

## Requirements

### Requirement: Create a short link from an original URL

The system SHALL expose `POST /api/links`, which accepts a JSON body containing an `originalUrl` field and optional `note` and `password` fields, generates a unique short code, and persists the link. When `password` is present, the system SHALL first transform its UTF-8 bytes with SHA-256 and Base64 encoding, then store only a bcrypt hash produced from that fixed-length value with cost factor 12. The system SHALL NOT persist the plaintext password or intermediate digest.

The response status SHALL be `201 Created` and the response body SHALL contain `shortCode`, `shortUrl`, `originalUrl`, `note`, `passwordProtected`, and `createdAt`. The `shortUrl` SHALL be the configured base URL joined with the generated short code. The response SHALL NOT contain `password` or `passwordHash`.

#### Scenario: Valid URL is shortened

- **WHEN** a client sends `POST /api/links` with body `{"originalUrl": "https://example.com/a/very/long/path"}`
- **THEN** the system responds `201` with a body whose `originalUrl` equals the submitted URL, whose `shortCode` is a 7-character alphanumeric string, whose `shortUrl` ends with that short code, whose `note` is null, and whose `passwordProtected` is false

##### Example: successful creation

- **GIVEN** the configured base URL is `http://localhost:3000`
- **WHEN** the client submits `{"originalUrl": "https://example.com/docs"}`
- **THEN** the response is `201` with `shortCode` = `aB3xY9z`, `shortUrl` = `http://localhost:3000/aB3xY9z`, `originalUrl` = `https://example.com/docs`, `note` = null, `passwordProtected` = false, and a `createdAt` ISO-8601 timestamp

#### Scenario: Optional note and password are stored safely

- **WHEN** a client submits `{"originalUrl":"https://example.com/private","note":"Project draft","password":"correct-horse"}` to `POST /api/links`
- **THEN** the system persists the note and a SHA-256-preprocessed bcrypt cost-12 hash that the password helper verifies for `correct-horse`, responds `201` with `note` = `Project draft` and `passwordProtected` = true, and omits `password`, the intermediate digest, and `passwordHash` from the response

#### Scenario: Each request produces a distinct short code

- **WHEN** a client submits the same `originalUrl` twice in two separate requests
- **THEN** the system responds `201` both times and the two responses carry different `shortCode` values


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