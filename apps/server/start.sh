#!/bin/bash
set -e

echo "Running database migrations..."
npx prisma migrate deploy || npx prisma db push --skip-generate || true

echo "Generating Prisma client..."
npx prisma generate

echo "Starting NEXUS server..."
node dist/index.js
