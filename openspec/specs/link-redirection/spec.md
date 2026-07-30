# link-redirection Specification

## Purpose

TBD - created by archiving change 'add-link-shortening-core'. Update Purpose after archive.

## Requirements

### Requirement: Redirect a short code to its original URL

The system SHALL expose `GET /:code`, which looks up the stored link for the given short code. When the link has no `passwordHash`, the system SHALL respond with status `302` and a `Location` header equal to the stored `originalUrl`. The response body SHALL be empty.

#### Scenario: Known short code redirects

- **WHEN** a client sends `GET /:code` for a short code that exists in storage without a password hash
- **THEN** the system responds `302` with a `Location` header equal to the stored original URL

##### Example: redirect to stored URL

- **GIVEN** storage holds `shortCode` = `aB3xY9z` mapped to `originalUrl` = `https://example.com/docs`
- **WHEN** the client sends `GET /aB3xY9z`
- **THEN** the response is `302` with `Location: https://example.com/docs` and an empty body


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
### Requirement: Require a password before redirecting protected links

When a stored link has a `passwordHash`, `GET /:code` SHALL respond `200` with a `text/html` password form that submits `password` as `application/x-www-form-urlencoded` to `POST /:code/unlock`. The form SHALL NOT expose the link note, original URL, plaintext password, or password hash. The unlock endpoint SHALL compare the submitted password with the stored bcrypt hash and SHALL redirect only after a successful comparison.

#### Scenario: Protected link displays a password form

- **WHEN** a client sends `GET /aB3xY9z` and the stored link has a password hash
- **THEN** the system responds `200` with a `text/html` form whose action is `/aB3xY9z/unlock`, and the response does not contain the link note, original URL, plaintext password, or password hash

#### Scenario: Correct password unlocks the redirect

- **WHEN** a client submits the correct `password` to `POST /aB3xY9z/unlock` for a protected link
- **THEN** the system responds `302` with a `Location` header equal to the stored original URL and an empty body

#### Scenario: Incorrect or missing password is rejected

- **WHEN** a client submits an incorrect password or omits `password` in `POST /aB3xY9z/unlock`
- **THEN** the system responds `401` with the password form and does not expose the link note, original URL, plaintext password, or password hash

#### Scenario: Protected link does not create an unlock session

- **WHEN** a client successfully unlocks a protected link and subsequently sends another `GET /aB3xY9z`
- **THEN** the system responds with the password form again rather than redirecting


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
### Requirement: Unknown short codes return not found

The system SHALL respond `404` when the requested short code has no matching record in storage. The system SHALL NOT redirect and SHALL NOT create a record in response to such a request.

#### Scenario: Unknown short code is rejected

- **WHEN** a client sends `GET /:code` for a short code that does not exist in storage
- **THEN** the system responds `404` with an error body whose `error.code` is `NOT_FOUND`

#### Scenario: Unknown short code cannot be unlocked

- **WHEN** a client sends `POST /zzzzzzz/unlock` with any password and no matching link exists
- **THEN** the system responds `404` with an error body whose `error.code` is `NOT_FOUND`


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
### Requirement: Redirect route does not shadow reserved paths

The redirect route matches any single-segment path, so the system SHALL register it after all other top-level routes. Requests to reserved paths SHALL be handled by their own routes rather than treated as short codes.

#### Scenario: Reserved path is not treated as a short code

- **WHEN** a client sends `GET /health`
- **THEN** the system responds `200` with body `{"status": "ok"}` rather than `404` or a redirect

#### Scenario: API path is not treated as a short code

- **WHEN** a client sends `POST /api/links` with a valid body
- **THEN** the request is handled by the link creation route and the system responds `201`

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
### Requirement: Disabled short codes return not found

The system SHALL treat a stored link whose enabled state is false as unavailable. Both `GET /:code` and `POST /:code/unlock` SHALL respond `404` with an error body whose `error.code` is `NOT_FOUND`, regardless of whether the disabled link has a password hash. The response SHALL NOT reveal that the short code exists or that it is disabled.

#### Scenario: Disabled unprotected link does not redirect

- **WHEN** a client sends `GET /project-draft` and storage contains that short code with enabled state false and no password hash
- **THEN** the system responds `404` with `error.code` equal to `NOT_FOUND` and does not return a `Location` header

#### Scenario: Disabled protected link does not display the password form

- **WHEN** a client sends `GET /private-draft` and storage contains that short code with enabled state false and a password hash
- **THEN** the system responds `404` with `error.code` equal to `NOT_FOUND` and does not return the password form

#### Scenario: Disabled protected link cannot be unlocked

- **WHEN** a client submits any password to `POST /private-draft/unlock` for a stored disabled link
- **THEN** the system responds `404` with `error.code` equal to `NOT_FOUND` and does not redirect


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
### Requirement: Present a centered branded password form

For an enabled password-protected link, the system SHALL return a server-rendered password form centered horizontally and vertically within the viewport. The page SHALL use the creation page's visual language: a light slate background, a white rounded card with a subtle border and shadow, dark slate headings, a labeled rounded password field with a visible focus treatment, and a dark primary submit button. The card MUST remain within a narrow viewport without horizontal overflow. The form MUST preserve `POST /:code/unlock`, the `password` field name, `autocomplete="current-password"`, and the required field behavior.

#### Scenario: Protected link displays the centered password form

- **WHEN** a client sends `GET /private-docs` and storage contains that enabled short code with a password hash
- **THEN** the system responds `200` with a viewport-centered card using the creation page visual language and a form that posts the required `password` field to `/private-docs/unlock`

#### Scenario: Invalid password remains accessible in the branded form

- **WHEN** a client submits an invalid password to `POST /private-docs/unlock`
- **THEN** the system responds `401` with the same centered branded form and exposes the Traditional Chinese error message as an alert

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