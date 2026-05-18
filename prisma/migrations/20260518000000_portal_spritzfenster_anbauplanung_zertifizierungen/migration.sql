-- CreateTable: KundePortalZugang
CREATE TABLE IF NOT EXISTS "KundePortalZugang" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "benutzername" TEXT NOT NULL,
    "passwortHash" TEXT NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "letzterLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KundePortalZugang_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: Anbauplan
CREATE TABLE IF NOT EXISTS "Anbauplan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "schlagId" INTEGER NOT NULL,
    "kundeId" INTEGER NOT NULL,
    "jahr" INTEGER NOT NULL,
    "fruchtart" TEXT NOT NULL,
    "sorte" TEXT,
    "aussaatDatum" DATETIME,
    "ernteDatum" DATETIME,
    "ertragDt" REAL,
    "status" TEXT NOT NULL DEFAULT 'geplant',
    "notiz" TEXT,
    "erstellt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Anbauplan_schlagId_fkey" FOREIGN KEY ("schlagId") REFERENCES "KundeSchlag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Anbauplan_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: Zertifizierung
CREATE TABLE IF NOT EXISTS "Zertifizierung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "typ" TEXT NOT NULL,
    "nummer" TEXT,
    "ausstellerOrg" TEXT,
    "ausstellungsdatum" DATETIME,
    "ablaufdatum" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'aktiv',
    "belegpfad" TEXT,
    "belegname" TEXT,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Zertifizierung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KundePortalZugang_kundeId_key" ON "KundePortalZugang"("kundeId");
CREATE UNIQUE INDEX IF NOT EXISTS "KundePortalZugang_benutzername_key" ON "KundePortalZugang"("benutzername");

-- CreateIndex for Anbauplan
CREATE INDEX IF NOT EXISTS "Anbauplan_schlagId_idx" ON "Anbauplan"("schlagId");
CREATE INDEX IF NOT EXISTS "Anbauplan_kundeId_idx" ON "Anbauplan"("kundeId");
CREATE INDEX IF NOT EXISTS "Anbauplan_jahr_idx" ON "Anbauplan"("jahr");

-- CreateIndex for Zertifizierung
CREATE INDEX IF NOT EXISTS "Zertifizierung_kundeId_idx" ON "Zertifizierung"("kundeId");
CREATE INDEX IF NOT EXISTS "Zertifizierung_ablaufdatum_idx" ON "Zertifizierung"("ablaufdatum");
CREATE INDEX IF NOT EXISTS "Zertifizierung_typ_idx" ON "Zertifizierung"("typ");
