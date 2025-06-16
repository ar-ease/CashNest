import { db } from "@/lib/prisma";
import { subDays } from "date-fns";
import { Decimal } from "@prisma/client/runtime/library";

// Database transaction client type
type DatabaseTransaction = Parameters<Parameters<typeof db.$transaction>[0]>[0];

const ACCOUNT_ID = "13d85ead-1228-4751-99c9-6944209e4f82";
const USER_ID = "5643ed10-5c76-4c49-b2db-bfa053eb4b9b";

// Categories with their typical amount ranges
const CATEGORIES = {
  INCOME: [
    { name: "salary", range: [5000, 8000] },
    { name: "freelance", range: [1000, 3000] },
    { name: "investments", range: [500, 2000] },
    { name: "other-income", range: [100, 1000] },
  ],
  EXPENSE: [
    { name: "housing", range: [1000, 2000] },
    { name: "transportation", range: [100, 500] },
    { name: "groceries", range: [200, 600] },
    { name: "utilities", range: [100, 300] },
    { name: "entertainment", range: [50, 200] },
    { name: "food", range: [50, 150] },
    { name: "shopping", range: [100, 500] },
    { name: "healthcare", range: [100, 1000] },
    { name: "education", range: [200, 1000] },
    { name: "travel", range: [500, 2000] },
  ],
};

// Helper to generate random amount within a range
function getRandomAmount(min: number, max: number): number {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

// Helper to get random category with amount
function getRandomCategory(type: "INCOME" | "EXPENSE"): {
  category: string;
  amount: number;
} {
  const categories = CATEGORIES[type];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const amount = getRandomAmount(category.range[0], category.range[1]);
  return { category: category.name, amount };
}

// Define return type
interface SeedResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function seedTransactions(): Promise<SeedResult> {
  try {
    // Generate 90 days of transactions
    const transactions: Array<{
      id: string;
      type: "INCOME" | "EXPENSE";
      amount: Decimal;
      description: string;
      date: Date;
      category: string;
      status: "COMPLETED";
      userId: string;
      accountId: string;
      isRecurring: boolean;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    let totalBalance = 0;

    for (let i = 90; i >= 0; i--) {
      const date = subDays(new Date(), i);
      // Generate 1-3 transactions per day
      const transactionsPerDay = Math.floor(Math.random() * 3) + 1;

      for (let j = 0; j < transactionsPerDay; j++) {
        // 40% chance of income, 60% chance of expense
        const type: "INCOME" | "EXPENSE" =
          Math.random() < 0.4 ? "INCOME" : "EXPENSE";
        const { category, amount } = getRandomCategory(type);

        const transaction = {
          id: crypto.randomUUID(),
          type,
          amount: new Decimal(amount),
          description: `${
            type === "INCOME" ? "Received" : "Paid for"
          } ${category}`,
          date,
          category,
          status: "COMPLETED" as const,
          userId: USER_ID,
          accountId: ACCOUNT_ID,
          isRecurring: false,
          createdAt: date,
          updatedAt: date,
        };

        totalBalance += type === "INCOME" ? amount : -amount;
        transactions.push(transaction);
      }
    }

    // Insert transactions and update account balance
    await db.$transaction(async (tx: DatabaseTransaction) => {
      // Clear existing transactions
      await tx.transaction.deleteMany({
        where: { accountId: ACCOUNT_ID },
      });

      // Insert new transactions
      for (const transaction of transactions) {
        await tx.transaction.create({
          data: transaction,
        });
      }

      // Update account balance
      await tx.account.update({
        where: { id: ACCOUNT_ID },
        data: { balance: new Decimal(totalBalance) },
      });
    });

    return {
      success: true,
      message: `Created ${transactions.length} transactions with total balance: ${totalBalance}`,
    };
  } catch (error) {
    console.error("Error seeding transactions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
