# page-metadata Specification

## Purpose

TBD - created by archiving change 'add-link-creation-web-ui'. Update Purpose after archive.

## Requirements

### Requirement: Retrieve public page metadata

The system SHALL expose `POST /api/page-metadata` accepting JSON with an `originalUrl` string. For a reachable public HTTP or HTTPS HTML page, the system SHALL return status `200` with exactly `title` and `description` string properties. It SHALL extract the document title and the HTML meta description, normalize runs of whitespace, limit the title to 300 characters, and limit the description to 500 characters. Missing metadata SHALL be represented by empty strings.

#### Scenario: HTML metadata is returned

- **WHEN** a client submits a public HTML URL whose title is `Example Docs` and meta description is `Reference guide`
- **THEN** the response is `200` with body `{"title":"Example Docs","description":"Reference guide"}`

#### Scenario: HTML page has no metadata

- **WHEN** a client submits a reachable public HTML URL containing neither a title nor a meta description
- **THEN** the response is `200` with body `{"title":"","description":""}`


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
### Requirement: Restrict metadata retrieval to safe public targets

The metadata endpoint MUST accept only absolute HTTP or HTTPS URLs without embedded credentials and with the default port for the selected scheme. Before the initial request and before every redirect, it MUST resolve the target hostname and reject the request when any resolved IPv4 or IPv6 address is loopback, private, link-local, multicast, unspecified, or otherwise reserved. It MUST follow no more than three redirects and MUST apply the same protocol, port, credential, and address checks to each redirect target.

#### Scenario: Private network target is blocked

- **WHEN** a client submits a URL whose hostname resolves to `127.0.0.1`, `10.0.0.1`, `169.254.169.254`, `::1`, or another non-public address
- **THEN** the system responds `400` with `error.code` equal to `INVALID_URL` and sends no HTTP request to that target

#### Scenario: Redirect to a private target is blocked

- **WHEN** a public target redirects to a hostname that resolves to a non-public address
- **THEN** the system stops following redirects and responds `400` with `error.code` equal to `INVALID_URL`

#### Scenario: Non-default port or embedded credentials are blocked

- **WHEN** a client submits `http://example.com:8080/` or `https://user:secret@example.com/`
- **THEN** the system responds `400` with `error.code` equal to `INVALID_URL`


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
### Requirement: Bound remote metadata work

The metadata endpoint MUST abort remote retrieval after five seconds, MUST read no more than 1 MiB of response content, and MUST accept only responses whose media type is `text/html` or `application/xhtml+xml`. A timeout, DNS or connection failure, redirect-limit overflow, oversized response, or unsupported media type SHALL produce status `422` with `error.code` equal to `METADATA_UNAVAILABLE`. Internal error details and retrieved page content MUST NOT appear in the response.

#### Scenario: Remote request times out

- **WHEN** the target does not complete the metadata response within five seconds
- **THEN** the system aborts the request and responds `422` with `error.code` equal to `METADATA_UNAVAILABLE`

#### Scenario: Response is not HTML

- **WHEN** the target responds successfully with media type `application/pdf`
- **THEN** the system responds `422` with `error.code` equal to `METADATA_UNAVAILABLE`

#### Scenario: Response exceeds the size limit

- **WHEN** the target response exceeds 1 MiB
- **THEN** the system stops reading the response and responds `422` with `error.code` equal to `METADATA_UNAVAILABLE`

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