-- AlterTable
ALTER TABLE "Gutschrift" ADD COLUMN "verbuchtBeiLieferungId" INTEGER REFERENCES "Lieferung"("id");
