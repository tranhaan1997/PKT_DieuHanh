-- CreateTable
CREATE TABLE "period_users" (
    "periodId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "period_users_pkey" PRIMARY KEY ("periodId","userId")
);

-- AddForeignKey
ALTER TABLE "period_users" ADD CONSTRAINT "period_users_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_users" ADD CONSTRAINT "period_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
