-- CreateTable
CREATE TABLE "Angebot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nummer" TEXT NOT NULL,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gueltigBis" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OFFEN',
    "kundeId" INTEGER NOT NULL,
    "notiz" TEXT,
    "erstellt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiert" DATETIME NOT NULL,
    CONSTRAINT "Angebot_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AngebotPosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "angebotId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "menge" REAL NOT NULL,
    "preis" REAL NOT NULL,
    "rabatt" REAL NOT NULL DEFAULT 0,
    "einheit" TEXT NOT NULL DEFAULT 'kg',
    "notiz" TEXT,
    CONSTRAINT "AngebotPosition_angebotId_fkey" FOREIGN KEY ("angebotId") REFERENCES "Angebot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AngebotPosition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KundeSchlag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "flaeche" REAL NOT NULL,
    "fruchtart" TEXT,
    "sorte" TEXT,
    "vorfrucht" TEXT,
    "aussaatJahr" INTEGER,
    "aussaatMenge" REAL,
    "notiz" TEXT,
    "erstellt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KundeSchlag_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Angebot_nummer_key" ON "Angebot"("nummer");

-- CreateIndex
CREATE INDEX "Angebot_kundeId_idx" ON "Angebot"("kundeId");

-- CreateIndex
CREATE INDEX "Angebot_status_idx" ON "Angebot"("status");

-- CreateIndex
CREATE INDEX "Angebot_datum_idx" ON "Angebot"("datum");

-- CreateIndex
CREATE INDEX "KundeSchlag_kundeId_idx" ON "KundeSchlag"("kundeId");
