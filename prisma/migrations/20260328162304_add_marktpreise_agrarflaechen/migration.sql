-- CreateTable
CREATE TABLE "MarktpreisCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dataset" TEXT NOT NULL,
    "produktCode" TEXT NOT NULL,
    "produktName" TEXT NOT NULL,
    "zeitraum" TEXT NOT NULL,
    "indexWert" REAL NOT NULL,
    "einheit" TEXT NOT NULL DEFAULT 'I15',
    "land" TEXT NOT NULL DEFAULT 'DE',
    "abgerufenAm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AgrarflaechenCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "radius" INTEGER NOT NULL,
    "flaecheHa" REAL NOT NULL,
    "polygonCount" INTEGER NOT NULL,
    "geojson" TEXT NOT NULL,
    "abgerufenAm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "MarktpreisCache_dataset_produktCode_zeitraum_land_key" ON "MarktpreisCache"("dataset", "produktCode", "zeitraum", "land");

-- CreateIndex
CREATE UNIQUE INDEX "AgrarflaechenCache_lat_lng_radius_key" ON "AgrarflaechenCache"("lat", "lng", "radius");
