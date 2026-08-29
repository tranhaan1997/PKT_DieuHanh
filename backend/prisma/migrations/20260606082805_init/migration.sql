-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'MANAGER');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "WrittenTicketStatus" AS ENUM ('EMPTY', 'WRITTEN');

-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('EMPTY', 'RECEIVED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "InstallStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('NOT_TAKEN', 'TAKEN');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'TECHNICIAN',
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" SERIAL NOT NULL,
    "siteCode" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "province" TEXT,
    "district" TEXT,
    "siteType" TEXT,
    "address" TEXT,
    "managerName" TEXT,
    "phone" TEXT,
    "sector5G" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solutions" (
    "id" SERIAL NOT NULL,
    "solutionCode" TEXT NOT NULL,
    "solutionName" TEXT NOT NULL,
    "description" TEXT,
    "expectedDays" INTEGER NOT NULL DEFAULT 30,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periods" (
    "id" SERIAL NOT NULL,
    "periodCode" TEXT NOT NULL,
    "periodName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER,

    CONSTRAINT "periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_solutions" (
    "periodId" INTEGER NOT NULL,
    "solutionId" INTEGER NOT NULL,

    CONSTRAINT "period_solutions_pkey" PRIMARY KEY ("periodId","solutionId")
);

-- CreateTable
CREATE TABLE "period_sites" (
    "periodId" INTEGER NOT NULL,
    "siteId" INTEGER NOT NULL,

    CONSTRAINT "period_sites_pkey" PRIMARY KEY ("periodId","siteId")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" SERIAL NOT NULL,
    "ticketNo" TEXT NOT NULL,
    "periodId" INTEGER NOT NULL,
    "siteId" INTEGER NOT NULL,
    "solutionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER,
    "writtenTicket" "WrittenTicketStatus" NOT NULL DEFAULT 'EMPTY',
    "actReceivedMaterial" "MaterialStatus" NOT NULL DEFAULT 'EMPTY',
    "ttkvReceivedMaterial" "MaterialStatus" NOT NULL DEFAULT 'EMPTY',
    "planDate" TIMESTAMP(3),
    "executorName" TEXT,
    "installationStatus" "InstallStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "photoStatus" "PhotoStatus" NOT NULL DEFAULT 'NOT_TAKEN',
    "integrationStatus" "InstallStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "note" TEXT,
    "issue" TEXT,
    "completedDate" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sites_siteCode_key" ON "sites"("siteCode");

-- CreateIndex
CREATE UNIQUE INDEX "solutions_solutionCode_key" ON "solutions"("solutionCode");

-- CreateIndex
CREATE UNIQUE INDEX "periods_periodCode_key" ON "periods"("periodCode");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_ticketNo_key" ON "work_orders"("ticketNo");

-- AddForeignKey
ALTER TABLE "periods" ADD CONSTRAINT "periods_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_solutions" ADD CONSTRAINT "period_solutions_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_solutions" ADD CONSTRAINT "period_solutions_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "solutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_sites" ADD CONSTRAINT "period_sites_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_sites" ADD CONSTRAINT "period_sites_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "solutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
