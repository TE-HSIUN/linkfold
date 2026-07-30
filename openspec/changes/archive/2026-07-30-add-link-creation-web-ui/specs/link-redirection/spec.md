## ADDED Requirements

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

### Requirement: Present a centered branded password form

For an enabled password-protected link, the system SHALL return a server-rendered password form centered horizontally and vertically within the viewport. The page SHALL use the creation page's visual language: a light slate background, a white rounded card with a subtle border and shadow, dark slate headings, a labeled rounded password field with a visible focus treatment, and a dark primary submit button. The card MUST remain within a narrow viewport without horizontal overflow. The form MUST preserve `POST /:code/unlock`, the `password` field name, `autocomplete="current-password"`, and the required field behavior.

#### Scenario: Protected link displays the centered password form

- **WHEN** a client sends `GET /private-docs` and storage contains that enabled short code with a password hash
- **THEN** the system responds `200` with a viewport-centered card using the creation page visual language and a form that posts the required `password` field to `/private-docs/unlock`

#### Scenario: Invalid password remains accessible in the branded form

- **WHEN** a client submits an invalid password to `POST /private-docs/unlock`
- **THEN** the system responds `401` with the same centered branded form and exposes the Traditional Chinese error message as an alert
