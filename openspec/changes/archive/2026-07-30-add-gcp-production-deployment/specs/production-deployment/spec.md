## ADDED Requirements

### Requirement: Start the production stack reproducibly
The system SHALL provide a production Docker Compose configuration that starts PostgreSQL, the Express backend, and the Nginx-served Vue frontend from the repository root with one documented command.

#### Scenario: First production startup
- **WHEN** an operator supplies all required production environment variables and runs the documented build-and-start command
- **THEN** Compose builds the application images and starts the database, backend, and web services

#### Scenario: Missing required secret
- **WHEN** an operator runs the production Compose command without POSTGRES_PASSWORD
- **THEN** Compose fails configuration validation before starting the stack and identifies the missing variable

### Requirement: Keep internal services private
The production stack SHALL expose only the Nginx web service on host port 80 and SHALL keep the PostgreSQL and Express service ports accessible only through the Compose network.

#### Scenario: Inspect published ports
- **WHEN** an operator renders the production Compose configuration
- **THEN** the web service publishes port 80 while the database port 5432 and backend port 3000 have no host port mapping

### Requirement: Persist database data
The production PostgreSQL service SHALL store its database directory in a named Docker volume and SHALL preserve that volume during a normal Compose down operation.

#### Scenario: Restart the production stack
- **WHEN** an operator stops the stack without requesting volume deletion and starts it again
- **THEN** previously created short links remain available

### Requirement: Apply database migrations before serving API traffic
The backend service SHALL generate the Prisma Client and apply committed Prisma migrations before starting Express, and SHALL terminate with a non-zero status when either preparation step fails.

#### Scenario: Successful migration startup
- **WHEN** PostgreSQL becomes healthy and all committed migrations can be applied
- **THEN** the backend starts Express and becomes healthy through GET /health

#### Scenario: Migration failure
- **WHEN** Prisma migration deployment returns an error
- **THEN** the backend does not start Express and the failure is visible in the container status or logs

### Requirement: Serve frontend and dynamic routes from one origin
Nginx SHALL serve the built Vue application at the root path and SHALL proxy /api/, /health, single-segment short-code paths, and short-code unlock paths to the Express backend before applying the Vue SPA fallback.

#### Scenario: Load the frontend
- **WHEN** a visitor requests /
- **THEN** Nginx returns the built Vue index page with HTTP 200

#### Scenario: Call the health endpoint
- **WHEN** a client requests /health through Nginx
- **THEN** Express returns HTTP 200 with a JSON body whose status field is ok

#### Scenario: Resolve a short code
- **WHEN** a visitor requests an existing single-segment short-code path
- **THEN** Nginx forwards the request to Express and Express performs the existing redirect or password flow

#### Scenario: Unknown static route
- **WHEN** a visitor requests a path that is neither a dynamic backend route nor an existing static asset
- **THEN** Nginx returns the Vue index page as the SPA fallback

### Requirement: Keep production secrets outside version control
The repository SHALL provide a committable production environment template, SHALL ignore the operator's actual production environment file, and SHALL require a URL-safe PostgreSQL password plus the public BASE_URL at deployment time.

#### Scenario: Prepare production configuration
- **WHEN** an operator copies the production environment template and fills the required values
- **THEN** Compose injects the database credentials and public base URL without requiring secrets in tracked configuration files

### Requirement: Report production health and recover after restart
The production services SHALL define health checks, SHALL order startup based on dependency health, and SHALL use an unless-stopped restart policy.

#### Scenario: VM restarts
- **WHEN** the VM and Docker daemon restart after a previously successful deployment
- **THEN** the database, backend, and web services restart automatically in dependency order unless the operator explicitly stopped them

#### Scenario: Backend is unavailable
- **WHEN** Nginx cannot connect to the backend for a proxied request
- **THEN** Nginx returns an upstream error response and does not return the Vue index page for that request

### Requirement: Document production operations
The repository SHALL document first deployment, environment preparation, build and startup, status inspection, health verification, log inspection, update, and non-destructive shutdown commands for the GCP VM.

#### Scenario: Follow the deployment runbook
- **WHEN** an operator follows the README from a clean Ubuntu VM with Docker, Docker Compose, and Git installed
- **THEN** the operator can start and verify Linkfold without needing undocumented commands
