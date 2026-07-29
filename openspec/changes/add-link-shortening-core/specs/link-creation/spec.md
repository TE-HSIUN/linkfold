## ADDED Requirements

### Requirement: Create a short link from an original URL

The system SHALL expose `POST /api/links`, which accepts a JSON body containing an `originalUrl` field, generates a unique short code for it, persists the pair, and returns the short code together with the full short URL.

The response status SHALL be `201 Created` and the response body SHALL contain `shortCode`, `shortUrl`, `originalUrl`, and `createdAt`. The `shortUrl` SHALL be the configured base URL joined with the generated short code.

#### Scenario: Valid URL is shortened

- **WHEN** a client sends `POST /api/links` with body `{"originalUrl": "https://example.com/a/very/long/path"}`
- **THEN** the system responds `201` with a body whose `originalUrl` equals the submitted URL, whose `shortCode` is a 7-character alphanumeric string, and whose `shortUrl` ends with that short code

##### Example: successful creation

- **GIVEN** the configured base URL is `http://localhost:3000`
- **WHEN** the client submits `{"originalUrl": "https://example.com/docs"}`
- **THEN** the response is `201` with `shortCode` = `aB3xY9z`, `shortUrl` = `http://localhost:3000/aB3xY9z`, `originalUrl` = `https://example.com/docs`, and a `createdAt` ISO-8601 timestamp

#### Scenario: Each request produces a distinct short code

- **WHEN** a client submits the same `originalUrl` twice in two separate requests
- **THEN** the system responds `201` both times and the two responses carry different `shortCode` values

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

### Requirement: Report service health

The system SHALL expose `GET /health`, which responds `200` with body `{"status": "ok"}` and SHALL NOT be shadowed by the short-code redirect route.

#### Scenario: Health check succeeds

- **WHEN** a client sends `GET /health`
- **THEN** the system responds `200` with body `{"status": "ok"}`
