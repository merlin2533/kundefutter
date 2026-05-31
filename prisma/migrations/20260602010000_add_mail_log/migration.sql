-- CreateTable
CREATE TABLE "MailLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "zeitpunkt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empfaenger" TEXT NOT NULL,
    "betreff" TEXT NOT NULL,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "status" TEXT NOT NULL DEFAULT 'gesendet',
    "fehler" TEXT,
    "feature" TEXT,
    "anhangNamen" TEXT
);

-- CreateIndex
CREATE INDEX "MailLog_zeitpunkt_idx" ON "MailLog"("zeitpunkt");

-- CreateIndex
CREATE INDEX "MailLog_status_idx" ON "MailLog"("status");
