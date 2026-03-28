#!/bin/sh
set -e

# Run migrations on startup
echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting KundeFutter..."
exec node server.js
