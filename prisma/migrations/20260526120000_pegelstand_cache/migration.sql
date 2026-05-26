-- CreateTable
CREATE TABLE IF NOT EXISTS "PegelstandCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stationUuid" TEXT NOT NULL,
    "stationKurz" TEXT NOT NULL,
    "stationLang" TEXT NOT NULL,
    "gewaesser" TEXT NOT NULL,
    "einheit" TEXT NOT NULL DEFAULT 'cm',
    "wert" REAL,
    "trend" INTEGER,
    "messung" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PegelstandCache_stationUuid_key" ON "PegelstandCache"("stationUuid");
CREATE INDEX IF NOT EXISTS "PegelstandCache_stationUuid_idx" ON "PegelstandCache"("stationUuid");
