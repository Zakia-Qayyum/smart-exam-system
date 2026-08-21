#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding database..."
npx prisma db seed

echo "Starting server..."
node dist/index.js
