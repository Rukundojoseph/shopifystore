-- CreateEnum
CREATE TYPE "public"."SavedTemplateKind" AS ENUM ('BLOCK', 'PAGE');

-- CreateTable
CREATE TABLE "public"."saved_templates" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "kind" "public"."SavedTemplateKind" NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_templates_storeId_kind_idx" ON "public"."saved_templates"("storeId", "kind");

-- AddForeignKey
ALTER TABLE "public"."saved_templates" ADD CONSTRAINT "saved_templates_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_templates" ADD CONSTRAINT "saved_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
