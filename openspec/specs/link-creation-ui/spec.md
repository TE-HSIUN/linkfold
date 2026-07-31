# link-creation-ui Specification

## Purpose

TBD - created by archiving change 'add-link-creation-web-ui'. Update Purpose after archive.

## Requirements

### Requirement: Display a responsive short-link creation form

The frontend SHALL provide a Vue route at `/` containing labeled controls for the original URL, optional custom short code, optional password, optional note, and enabled state. The note control MUST enforce a 500-character maximum and display its current character count. The password control SHALL provide a keyboard-operable show or hide control. The enabled control SHALL default to enabled.

#### Scenario: User opens the creation page

- **WHEN** a user navigates to `/`
- **THEN** the frontend displays every creation control, a page-metadata action, and a submit action without requiring authentication

#### Scenario: Layout adapts to a narrow viewport

- **WHEN** the page is rendered at a 320-pixel viewport width
- **THEN** controls are stacked in a single column, all content remains within the viewport, and every action remains keyboard and pointer operable


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
### Requirement: Validate creation input before submission

The frontend MUST require an absolute HTTP or HTTPS original URL. A custom short code, when present, MUST contain 4 to 32 lowercase ASCII letters, digits, or hyphens, MUST begin and end with a letter or digit, and MUST NOT equal a reserved route. A password, when present, MUST contain 8 to 128 characters. The frontend SHALL omit blank optional `shortCode`, `note`, and `password` properties from the API request rather than sending empty strings, while it SHALL always send the boolean `enabled` state.

#### Scenario: Invalid input remains on the form

- **WHEN** the user submits an invalid original URL, custom short code, password, or over-500-character note
- **THEN** the frontend does not call the creation API, associates a Traditional Chinese error message with each invalid control, and moves focus to the first invalid control

#### Scenario: Blank optional fields are omitted

- **WHEN** the user submits a valid original URL with custom short code, note, and password left blank and enabled selected
- **THEN** the frontend calls `POST /api/links` with `originalUrl` and `enabled: true` and without `shortCode`, `note`, or `password` properties


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
### Requirement: Prefill the note from page metadata

The page-metadata action SHALL be disabled until the original URL passes frontend URL validation. Activating it SHALL call `POST /api/page-metadata` independently from short-link creation. The frontend SHALL combine a non-empty title and description with a newline and limit the resulting note to 500 characters. It SHALL immediately fill an empty note, but it MUST NOT replace a non-empty note until the user activates an explicit replacement action.

#### Scenario: Metadata fills an empty note

- **WHEN** the metadata API returns title `Example Docs` and description `Reference guide` while the note is empty
- **THEN** the note becomes `Example Docs\nReference guide` and remains editable

#### Scenario: Existing note is protected from replacement

- **WHEN** the metadata API succeeds while the note already contains user text
- **THEN** the frontend preserves the existing note and offers an explicit action to replace it with the fetched text

#### Scenario: Metadata retrieval fails

- **WHEN** the metadata API returns an error or returns empty title and description values
- **THEN** the frontend displays a non-blocking Traditional Chinese message, preserves the note, and keeps short-link submission available


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
### Requirement: Present creation progress and result

The frontend SHALL prevent duplicate creation requests while `POST /api/links` is pending. After a successful response, it SHALL display the short URL, original URL, password-protected state, enabled state, and actions to copy the short URL and create another link. It SHALL display an open-link action only when the result is enabled. The copy action MUST first use the Clipboard API when available. When the Clipboard API is unavailable or rejects the write, the copy action MUST select the complete displayed short URL and attempt a synchronous browser copy fallback within the same user action. The frontend SHALL report success when either copy path succeeds. It SHALL retain the complete text selection and report a manual-copy instruction only when both paths fail. Copy feedback and request status MUST be exposed through an ARIA live region.

#### Scenario: Enabled link is created

- **WHEN** the creation API returns a successful response with `enabled: true`
- **THEN** the result displays the short URL with copy and open actions and displays the returned protection and enabled states

#### Scenario: Disabled link is created

- **WHEN** the creation API returns a successful response with `enabled: false`
- **THEN** the result displays a disabled status, provides the copy action, omits the open action, and explains that this MVP cannot reactivate the link

#### Scenario: Duplicate submission is prevented

- **WHEN** a creation request is pending and the user activates the submit action again
- **THEN** the frontend sends no additional creation request and keeps the pending state visible

#### Scenario: Clipboard API copies the short URL

- **WHEN** the user activates the copy action and the Clipboard API successfully writes the displayed short URL
- **THEN** the fallback is not invoked and the live region reports that the short URL was copied

#### Scenario: Insecure origin uses the copy fallback

- **WHEN** the user activates the copy action on an origin where the Clipboard API is unavailable
- **THEN** the frontend selects the complete displayed short URL, invokes the synchronous copy fallback, and reports success when the fallback succeeds

#### Scenario: Clipboard rejection uses the copy fallback

- **WHEN** the user activates the copy action and the Clipboard API rejects the write
- **THEN** the frontend attempts the synchronous copy fallback and reports success when the fallback succeeds

#### Scenario: Every automatic copy path fails

- **WHEN** the Clipboard API is unavailable or rejects the write and the synchronous copy fallback returns failure or throws an error
- **THEN** the frontend keeps the complete displayed short URL selected and the live region instructs the user to copy it manually


<!-- @trace
source: fix-production-short-url-copy
updated: 2026-07-31
code:
  - frontend/src/components/LinkResultCard.vue
tests:
  - frontend/src/__tests__/CreateLinkView.test.js
-->

---
### Requirement: Surface API failures at the correct scope

The frontend SHALL map `INVALID_URL`, `INVALID_SHORT_CODE`, `SHORT_CODE_TAKEN`, `INVALID_NOTE`, `INVALID_PASSWORD`, and `INVALID_ENABLED` to the corresponding form control. Unknown server failures and network failures SHALL appear as a form-level Traditional Chinese message without clearing user input.

#### Scenario: Custom code is already in use

- **WHEN** the creation API responds `409` with `error.code` equal to `SHORT_CODE_TAKEN`
- **THEN** the frontend preserves all input, associates the conflict message with the custom short-code control, and focuses that control

#### Scenario: Network request fails

- **WHEN** Axios cannot receive a creation response
- **THEN** the frontend preserves all input and displays a form-level retryable error message

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