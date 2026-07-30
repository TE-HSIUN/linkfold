## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Validate custom short codes

When `shortCode` is present, it MUST be a string containing 4 to 32 lowercase ASCII letters, digits, or hyphens, MUST begin and end with a letter or digit, and MUST NOT equal a reserved top-level route. Invalid custom codes SHALL produce status `400` with `error.code` equal to `INVALID_SHORT_CODE` and SHALL NOT persist a record.

#### Scenario: Valid custom short code is accepted

- **WHEN** a client submits `shortCode` equal to `project-docs-2026`
- **THEN** the link is created with exactly `project-docs-2026`

#### Scenario: Invalid custom short code is rejected

- **WHEN** a client submits a custom code shorter than 4 characters, longer than 32 characters, containing uppercase letters, underscores, spaces, or other symbols, beginning or ending with a hyphen, or equal to a reserved route such as `health`
- **THEN** the system responds `400` with `error.code` equal to `INVALID_SHORT_CODE` and writes no link

### Requirement: Reject a conflicting custom short code

The system SHALL preserve the unique short-code constraint. When a requested custom short code already exists, the system SHALL respond status `409` with `error.code` equal to `SHORT_CODE_TAKEN`, SHALL NOT replace the existing link, and SHALL NOT retry with a generated code.

#### Scenario: Requested short code already exists

- **WHEN** storage already contains `shortCode` equal to `project-docs` and a client requests that same custom code
- **THEN** the system responds `409` with `error.code` equal to `SHORT_CODE_TAKEN` and the existing link remains unchanged

### Requirement: Validate the enabled state

When `enabled` is present, it MUST be a boolean. A missing `enabled` field SHALL mean enabled. Any other value SHALL produce status `400` with `error.code` equal to `INVALID_ENABLED` and SHALL NOT persist a record.

#### Scenario: Explicit disabled state is accepted

- **WHEN** a client submits a valid link with `enabled` equal to false
- **THEN** the system persists and returns `enabled` equal to false

#### Scenario: Non-boolean enabled state is rejected

- **WHEN** a client submits `enabled` equal to `"false"`, `0`, or null
- **THEN** the system responds `400` with `error.code` equal to `INVALID_ENABLED` and writes no link
