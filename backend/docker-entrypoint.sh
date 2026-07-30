#!/bin/sh

set -eu

npx prisma generate
npx prisma migrate deploy

exec "$@"
