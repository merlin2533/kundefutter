-- Unterkategorie für Artikel (z.B. bei Saatgut: Mais, Raps, Getreide, Gräser, ...)
ALTER TABLE "Artikel" ADD COLUMN "unterkategorie" TEXT;
CREATE INDEX "Artikel_unterkategorie_idx" ON "Artikel"("unterkategorie");
