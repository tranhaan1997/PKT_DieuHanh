-- CreateTable
CREATE TABLE "work_order_logs" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_order_logs_workOrderId_createdAt_idx" ON "work_order_logs"("workOrderId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "work_order_logs" ADD CONSTRAINT "work_order_logs_workOrderId_fkey"
    FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_logs" ADD CONSTRAINT "work_order_logs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
