/*
  Warnings:

  - You are about to drop the column `nextReccurenceDate` on the `transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "nextReccurenceDate",
ADD COLUMN     "nextRecurringDate" TIMESTAMP(3);
