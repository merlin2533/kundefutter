#!/bin/sh
set -e

# Check outbound connectivity
echo "Prüfe Netzwerkverbindung (google.de)..."
if ping -c 1 -W 3 google.de > /dev/null 2>&1; then
  echo "Netzwerkverbindung: OK"
else
  echo "WARNUNG: Kein Ping zu google.de möglich – eingeschränkte Internetverbindung"
fi

# Run migrations on startup
echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting KundeFutter..."
exec node server.js
