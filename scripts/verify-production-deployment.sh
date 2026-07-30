#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

required_files=(
  "backend/Dockerfile"
  "backend/docker-entrypoint.sh"
  "backend/.dockerignore"
  "frontend/Dockerfile"
  "frontend/nginx.conf"
  "frontend/.dockerignore"
  "docker-compose.prod.yml"
  ".env.production.example"
)

for required_file in "${required_files[@]}"; do
  if [[ ! -f "$required_file" ]]; then
    echo "Missing required production file: $required_file" >&2
    exit 1
  fi
done

generate_line="$(grep -nF 'npx prisma generate' backend/docker-entrypoint.sh | cut -d: -f1)"
migrate_line="$(grep -nF 'npx prisma migrate deploy' backend/docker-entrypoint.sh | cut -d: -f1)"
start_line="$(grep -nF 'exec "$@"' backend/docker-entrypoint.sh | cut -d: -f1)"

if [[ -z "$generate_line" || -z "$migrate_line" || -z "$start_line" ]]; then
  echo "Backend entrypoint must generate Prisma Client, deploy migrations, and exec the app command" >&2
  exit 1
fi

if ! ((generate_line < migrate_line && migrate_line < start_line)); then
  echo "Backend entrypoint commands are in the wrong order" >&2
  exit 1
fi

if ! grep -qF 'FROM node:22-alpine' backend/Dockerfile; then
  echo "Backend image must use Node 22 Alpine" >&2
  exit 1
fi

if ! grep -qF 'FROM node:22-alpine AS build' frontend/Dockerfile; then
  echo "Frontend image must use a Node 22 Alpine build stage" >&2
  exit 1
fi

api_line="$(grep -nF 'location /api/' frontend/nginx.conf | cut -d: -f1)"
health_line="$(grep -nF 'location = /health' frontend/nginx.conf | cut -d: -f1)"
unlock_line="$(grep -nF '/unlock$' frontend/nginx.conf | cut -d: -f1)"
short_code_line="$(grep -nF '{4,32}$' frontend/nginx.conf | cut -d: -f1)"
fallback_line="$(grep -nF 'try_files $uri $uri/ /index.html' frontend/nginx.conf | cut -d: -f1)"

if [[ -z "$api_line" || -z "$health_line" || -z "$unlock_line" || -z "$short_code_line" || -z "$fallback_line" ]]; then
  echo "Nginx must define API, health, short-code, unlock, and SPA fallback routes" >&2
  exit 1
fi

if ! ((api_line < fallback_line && health_line < fallback_line && unlock_line < fallback_line && short_code_line < fallback_line)); then
  echo "Nginx dynamic routes must be defined before the SPA fallback" >&2
  exit 1
fi

if ! git check-ignore --quiet .env.production; then
  echo ".env.production must be ignored by Git" >&2
  exit 1
fi

if git check-ignore --quiet .env.production.example; then
  echo ".env.production.example must remain committable" >&2
  exit 1
fi

readme_contract=(
  "cp .env.production.example .env.production"
  "openssl rand -hex 32"
  "docker compose --env-file .env.production -f docker-compose.prod.yml config"
  "docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build"
  "docker compose --env-file .env.production -f docker-compose.prod.yml ps"
  "curl -i http://127.0.0.1/health"
  "docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100"
  "git pull --ff-only"
  "docker compose --env-file .env.production -f docker-compose.prod.yml down"
  "down -v"
  "目前僅提供 HTTP"
)

for required_documentation in "${readme_contract[@]}"; do
  if ! grep -qF "$required_documentation" README.md; then
    echo "README is missing production operation: $required_documentation" >&2
    exit 1
  fi
done

missing_secret_output="$(
  env -u POSTGRES_PASSWORD -u BASE_URL \
    docker compose \
      --env-file /dev/null \
      -f docker-compose.prod.yml \
      config 2>&1 || true
)"

if [[ "$missing_secret_output" != *"POSTGRES_PASSWORD"* ]]; then
  echo "Compose must reject a missing POSTGRES_PASSWORD" >&2
  exit 1
fi

compose_json="$(
  POSTGRES_PASSWORD=deployment-test-password \
  BASE_URL=http://203.0.113.10 \
    docker compose \
      --env-file /dev/null \
      -f docker-compose.prod.yml \
      config \
      --format json
)"

COMPOSE_JSON="$compose_json" node <<'NODE'
const config = JSON.parse(process.env.COMPOSE_JSON);
const serviceNames = Object.keys(config.services ?? {}).sort();
const expectedServices = ['backend', 'db', 'web'];

if (JSON.stringify(serviceNames) !== JSON.stringify(expectedServices)) {
  throw new Error(
    `Expected services ${expectedServices.join(', ')}, got ${serviceNames.join(', ')}`,
  );
}

for (const serviceName of expectedServices) {
  const service = config.services[serviceName];

  if (service.restart !== 'unless-stopped') {
    throw new Error(`${serviceName} must use restart: unless-stopped`);
  }

  if (!service.healthcheck?.test) {
    throw new Error(`${serviceName} must define a health check`);
  }
}

for (const internalService of ['db', 'backend']) {
  const ports = config.services[internalService].ports ?? [];
  if (ports.length > 0) {
    throw new Error(`${internalService} must not publish host ports`);
  }
}

const webPorts = config.services.web.ports ?? [];
const publishesPort80 = webPorts.some(
  (port) =>
    Number(port.published) === 80 &&
    Number(port.target) === 80 &&
    port.protocol === 'tcp',
);

if (!publishesPort80 || webPorts.length !== 1) {
  throw new Error('web must publish only host port 80 to container port 80');
}

if (config.services.backend.depends_on?.db?.condition !== 'service_healthy') {
  throw new Error('backend must wait for a healthy database');
}

if (config.services.web.depends_on?.backend?.condition !== 'service_healthy') {
  throw new Error('web must wait for a healthy backend');
}

const databaseMounts = config.services.db.volumes ?? [];
const persistentDatabaseMount = databaseMounts.find(
  (mount) =>
    mount.type === 'volume' &&
    mount.target === '/var/lib/postgresql/data',
);

if (!persistentDatabaseMount || !config.volumes?.[persistentDatabaseMount.source]) {
  throw new Error('database data must use a named volume');
}

const backendEnvironment = config.services.backend.environment ?? {};
if (
  backendEnvironment.DATABASE_URL !==
  'postgresql://linkfold:deployment-test-password@db:5432/linkfold'
) {
  throw new Error('backend DATABASE_URL must use the internal db service');
}

if (backendEnvironment.BASE_URL !== 'http://203.0.113.10') {
  throw new Error('backend must receive BASE_URL from deployment configuration');
}
NODE

echo "Production deployment contract checks passed."
