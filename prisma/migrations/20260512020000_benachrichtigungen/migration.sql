-- CreateTable
CREATE TABLE "Benachrichtigung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "typ" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "prioritaet" TEXT NOT NULL DEFAULT 'info',
    "gelesen" BOOLEAN NOT NULL DEFAULT false,
    "kundeId" INTEGER,
    "artikelId" INTEGER,
    "link" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Benachrichtigung_gelesen_idx" ON "Benachrichtigung"("gelesen");

-- CreateIndex
CREATE INDEX "Benachrichtigung_createdAt_idx" ON "Benachrichtigung"("createdAt");

-- CreateIndex
CREATE INDEX "Benachrichtigung_typ_idx" ON "Benachrichtigung"("typ");
