-- CreateTable
CREATE TABLE "KundeNotiz" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "thema" TEXT,
    "erstellt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KundeNotiz_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KundeNotiz_kundeId_idx" ON "KundeNotiz"("kundeId");
