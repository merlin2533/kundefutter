-- CreateIndex
CREATE INDEX "Lieferung_kundeId_idx" ON "Lieferung"("kundeId");

-- CreateIndex
CREATE INDEX "Lieferung_status_idx" ON "Lieferung"("status");

-- CreateIndex
CREATE INDEX "Lieferung_datum_idx" ON "Lieferung"("datum");
