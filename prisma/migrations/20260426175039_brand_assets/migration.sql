-- CreateTable
CREATE TABLE "brand_assets" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "kind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_assets_key_key" ON "brand_assets"("key");

-- CreateIndex
CREATE INDEX "brand_assets_createdAt_idx" ON "brand_assets"("createdAt");
