-- CreateTable
CREATE TABLE "Benutzer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "benutzername" TEXT NOT NULL,
    "passwortHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "rolle" TEXT NOT NULL DEFAULT 'benutzer',
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "letzterLogin" DATETIME,
    "erstelltAm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geaendertAm" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Benutzer_benutzername_key" ON "Benutzer"("benutzername");

-- CreateIndex
CREATE INDEX "Benutzer_aktiv_idx" ON "Benutzer"("aktiv");
