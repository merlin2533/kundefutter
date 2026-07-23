-- Referenz auf die Quell-Entität (Lieferung/Gutschrift/Angebot), damit der PDF-Anhang
-- beim "Erneut senden" im Mail-Log neu erzeugt werden kann statt verloren zu gehen.
ALTER TABLE "MailLog" ADD COLUMN "entityId" INTEGER;
