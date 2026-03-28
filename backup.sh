#!/bin/sh
# SQLite Backup-Skript — läuft täglich als Cron-Job im backup-Service
set -e

DB="/data/kundefutter.db"
BACKUP_DIR="/backups"
DATE=$(date +%Y-%m-%d_%H-%M)
DEST="${BACKUP_DIR}/kundefutter_${DATE}.db"

# Backup nur wenn Datenbank existiert
if [ ! -f "$DB" ]; then
  echo "Datenbank nicht gefunden: $DB"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# SQLite Online-Backup via .backup (konsistent auch bei laufenden Writes)
sqlite3 "$DB" ".backup '${DEST}'"
echo "Backup erstellt: $DEST ($(du -h "$DEST" | cut -f1))"

# Alte Backups löschen (älter als 30 Tage)
find "$BACKUP_DIR" -name "kundefutter_*.db" -mtime +30 -delete
echo "Backups älter als 30 Tage gelöscht."
echo "Aktuelle Backups: $(ls -1 "$BACKUP_DIR"/kundefutter_*.db 2>/dev/null | wc -l)"
