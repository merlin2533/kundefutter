-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "zeitpunkt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entitaet" TEXT NOT NULL,
    "entitaetId" INTEGER NOT NULL,
    "aktion" TEXT NOT NULL,
    "feld" TEXT,
    "alterWert" TEXT,
    "neuerWert" TEXT,
    "beschreibung" TEXT
);

-- CreateIndex
CREATE INDEX "AuditLog_entitaet_entitaetId_idx" ON "AuditLog"("entitaet", "entitaetId");

-- CreateIndex
CREATE INDEX "AuditLog_zeitpunkt_idx" ON "AuditLog"("zeitpunkt");
