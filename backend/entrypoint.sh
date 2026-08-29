#!/bin/sh
set -e

ENCODED_PASS=$(node -e "process.stdout.write(encodeURIComponent(process.env.POSTGRES_PASSWORD || ''))")
export DATABASE_URL="postgresql://${POSTGRES_USER}:${ENCODED_PASS}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

npx prisma migrate deploy
exec node dist/src/main
