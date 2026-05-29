-- CreateTable
CREATE TABLE "MqttRegel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "topicPattern" TEXT NOT NULL,
    "modus" TEXT NOT NULL DEFAULT 'ki',
    "aktion" TEXT NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "MqttRegel_aktiv_idx" ON "MqttRegel"("aktiv");
