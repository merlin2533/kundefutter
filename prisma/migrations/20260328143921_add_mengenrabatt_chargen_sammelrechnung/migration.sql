-- CreateTable
CREATE TABLE "Mengenrabatt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER,
    "artikelId" INTEGER,
    "kategorie" TEXT,
    "vonMenge" REAL NOT NULL,
    "rabattProzent" REAL NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mengenrabatt_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Mengenrabatt_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sammelrechnung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "rechnungNr" TEXT,
    "rechnungDatum" DATETIME,
    "bezahltAm" DATETIME,
    "zahlungsziel" INTEGER NOT NULL DEFAULT 30,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sammelrechnung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lieferposition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lieferungId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "menge" REAL NOT NULL,
    "verkaufspreis" REAL NOT NULL,
    "einkaufspreis" REAL NOT NULL DEFAULT 0,
    "chargeNr" TEXT,
    "rabattProzent" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Lieferposition_lieferungId_fkey" FOREIGN KEY ("lieferungId") REFERENCES "Lieferung" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lieferposition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Lieferposition" ("artikelId", "einkaufspreis", "id", "lieferungId", "menge", "verkaufspreis") SELECT "artikelId", "einkaufspreis", "id", "lieferungId", "menge", "verkaufspreis" FROM "Lieferposition";
DROP TABLE "Lieferposition";
ALTER TABLE "new_Lieferposition" RENAME TO "Lieferposition";
CREATE TABLE "new_Lieferung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'geplant',
    "stornoBegründung" TEXT,
    "notiz" TEXT,
    "rechnungNr" TEXT,
    "rechnungDatum" DATETIME,
    "bezahltAm" DATETIME,
    "zahlungsziel" INTEGER DEFAULT 30,
    "wiederkehrend" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sammelrechnungId" INTEGER,
    CONSTRAINT "Lieferung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lieferung_sammelrechnungId_fkey" FOREIGN KEY ("sammelrechnungId") REFERENCES "Sammelrechnung" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lieferung" ("bezahltAm", "createdAt", "datum", "id", "kundeId", "notiz", "rechnungDatum", "rechnungNr", "status", "stornoBegründung", "updatedAt", "wiederkehrend", "zahlungsziel") SELECT "bezahltAm", "createdAt", "datum", "id", "kundeId", "notiz", "rechnungDatum", "rechnungNr", "status", "stornoBegründung", "updatedAt", "wiederkehrend", "zahlungsziel" FROM "Lieferung";
DROP TABLE "Lieferung";
ALTER TABLE "new_Lieferung" RENAME TO "Lieferung";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
