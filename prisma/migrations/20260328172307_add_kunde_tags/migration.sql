-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Kunde" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "firma" TEXT,
    "kategorie" TEXT NOT NULL DEFAULT 'Sonstige',
    "verantwortlicher" TEXT,
    "betriebsnummer" TEXT,
    "flaeche" REAL,
    "strasse" TEXT,
    "plz" TEXT,
    "ort" TEXT,
    "land" TEXT NOT NULL DEFAULT 'Deutschland',
    "lat" REAL,
    "lng" REAL,
    "notizen" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Kunde" ("aktiv", "betriebsnummer", "createdAt", "firma", "flaeche", "id", "kategorie", "land", "lat", "lng", "name", "notizen", "ort", "plz", "strasse", "updatedAt", "verantwortlicher") SELECT "aktiv", "betriebsnummer", "createdAt", "firma", "flaeche", "id", "kategorie", "land", "lat", "lng", "name", "notizen", "ort", "plz", "strasse", "updatedAt", "verantwortlicher" FROM "Kunde";
DROP TABLE "Kunde";
ALTER TABLE "new_Kunde" RENAME TO "Kunde";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
