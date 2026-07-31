## MODIFIED Requirements

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
