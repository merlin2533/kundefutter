-- Google Drive wird durch die Nextcloud-Dokumentensynchronisation ersetzt.
-- Nextcloud-Ordnerpfade sind deterministisch aus (id, Name) berechenbar und
-- müssen daher, anders als Google-Drive-Ordner-IDs, nicht in der DB gecacht werden.

-- AlterTable
ALTER TABLE "Kunde" DROP COLUMN "driveOrdnerId";

-- AlterTable
ALTER TABLE "Artikel" DROP COLUMN "driveOrdnerId";
