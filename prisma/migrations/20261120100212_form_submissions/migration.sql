-- CreateTable
CREATE TABLE "public"."form_submissions" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "formName" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "pagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_submissions_storeId_createdAt_idx" ON "public"."form_submissions"("storeId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."form_submissions" ADD CONSTRAINT "form_submissions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
