-- Index on Benachrichtigung.kundeId for faster per-customer notification queries
CREATE INDEX IF NOT EXISTS "Benachrichtigung_kundeId_idx" ON "Benachrichtigung"("kundeId");
