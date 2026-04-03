-- CreateTable
CREATE TABLE "KiNutzung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "zeitpunkt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL,
    "modell" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL,
    "tokensOut" INTEGER NOT NULL,
    "kostenCent" INTEGER NOT NULL DEFAULT 0,
    "erfolgreich" BOOLEAN NOT NULL DEFAULT true,
    "fehler" TEXT
);
