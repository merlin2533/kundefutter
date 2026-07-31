-- Alte Forderungen: Restdifferenz aus einer Unterzahlung (Bankabgleich), auf den
-- Kunden statt auf die einzelne Lieferung verankert, damit sie über die ursprüngliche
-- Lieferung hinaus bestehen bleibt, bis sie auf einer neuen Rechnung mit aufgeführt wird.

CREATE TABLE "KundeForderung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "betrag" REAL NOT NULL,
    "grund" TEXT NOT NULL,
    "quelleLieferungId" INTEGER,
    "erledigt" BOOLEAN NOT NULL DEFAULT false,
    "erledigtBeiLieferungId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KundeForderung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KundeForderung_quelleLieferungId_fkey" FOREIGN KEY ("quelleLieferungId") REFERENCES "Lieferung" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KundeForderung_erledigtBeiLieferungId_fkey" FOREIGN KEY ("erledigtBeiLieferungId") REFERENCES "Lieferung" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "KundeForderung_kundeId_idx" ON "KundeForderung"("kundeId");
CREATE INDEX "KundeForderung_erledigt_idx" ON "KundeForderung"("erledigt");
