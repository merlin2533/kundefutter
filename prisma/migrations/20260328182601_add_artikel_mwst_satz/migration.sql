-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Artikel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "artikelnummer" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kategorie" TEXT NOT NULL,
    "einheit" TEXT NOT NULL DEFAULT 'kg',
    "beschreibung" TEXT,
    "standardpreis" REAL NOT NULL DEFAULT 0,
    "mwstSatz" REAL NOT NULL DEFAULT 19,
    "mindestbestand" REAL NOT NULL DEFAULT 0,
    "aktuellerBestand" REAL NOT NULL DEFAULT 0,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "lagerort" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Artikel" ("aktiv", "aktuellerBestand", "artikelnummer", "beschreibung", "createdAt", "einheit", "id", "kategorie", "lagerort", "mindestbestand", "name", "standardpreis", "updatedAt") SELECT "aktiv", "aktuellerBestand", "artikelnummer", "beschreibung", "createdAt", "einheit", "id", "kategorie", "lagerort", "mindestbestand", "name", "standardpreis", "updatedAt" FROM "Artikel";
DROP TABLE "Artikel";
ALTER TABLE "new_Artikel" RENAME TO "Artikel";
CREATE UNIQUE INDEX "Artikel_artikelnummer_key" ON "Artikel"("artikelnummer");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
