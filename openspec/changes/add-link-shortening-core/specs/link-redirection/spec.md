## ADDED Requirements

### Requirement: Redirect a short code to its original URL

The system SHALL expose `GET /:code`, which looks up the stored link for the given short code. When the link has no `passwordHash`, the system SHALL respond with status `302` and a `Location` header equal to the stored `originalUrl`. The response body SHALL be empty.

#### Scenario: Known short code redirects

- **WHEN** a client sends `GET /:code` for a short code that exists in storage without a password hash
- **THEN** the system responds `302` with a `Location` header equal to the stored original URL

##### Example: redirect to stored URL

- **GIVEN** storage holds `shortCode` = `aB3xY9z` mapped to `originalUrl` = `https://example.com/docs`
- **WHEN** the client sends `GET /aB3xY9z`
- **THEN** the response is `302` with `Location: https://example.com/docs` and an empty body

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

### Requirement: Unknown short codes return not found

The system SHALL respond `404` when the requested short code has no matching record in storage. The system SHALL NOT redirect and SHALL NOT create a record in response to such a request.

#### Scenario: Unknown short code is rejected

- **WHEN** a client sends `GET /:code` for a short code that does not exist in storage
- **THEN** the system responds `404` with an error body whose `error.code` is `NOT_FOUND`

#### Scenario: Unknown short code cannot be unlocked

- **WHEN** a client sends `POST /zzzzzzz/unlock` with any password and no matching link exists
- **THEN** the system responds `404` with an error body whose `error.code` is `NOT_FOUND`

### Requirement: Redirect route does not shadow reserved paths

The redirect route matches any single-segment path, so the system SHALL register it after all other top-level routes. Requests to reserved paths SHALL be handled by their own routes rather than treated as short codes.

#### Scenario: Reserved path is not treated as a short code

- **WHEN** a client sends `GET /health`
- **THEN** the system responds `200` with body `{"status": "ok"}` rather than `404` or a redirect

#### Scenario: API path is not treated as a short code

- **WHEN** a client sends `POST /api/links` with a valid body
- **THEN** the request is handled by the link creation route and the system responds `201`
