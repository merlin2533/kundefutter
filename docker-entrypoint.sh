#!/bin/sh
set -e

# Run migrations on startup
echo "Running database migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "Starting KundeFutter..."
exec node server.js
