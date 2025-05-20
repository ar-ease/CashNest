"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getCurrentBudget(accountId: string) {
  try {
    // Authentication
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Debug - Log user info
    console.log("User found:", { userId: user.id, clerkId: user.clerkUserId });

    // Get user's budget
    const budget = await db.budget.findFirst({
      where: {
        userId: user.id,
      },
    });

    // Debug - Log budget
    console.log(
      "Budget found:",
      budget ? { amount: budget.amount.toString() } : null
    );

    // Get current month's expenses
    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );

    // Debug - Log date range
    console.log("Date range for expenses:", {
      startOfMonth: startOfMonth.toISOString(),
      endOfMonth: endOfMonth.toISOString(),
      accountId,
    });

    // DEBUG STEP 1: First check if there are ANY transactions for this user
    const allTransactionsCount = await db.transaction.count({
      where: {
        userId: user.id,
      },
    });
    console.log(`Total transactions for user: ${allTransactionsCount}`);

    // DEBUG STEP 2: Check if there are ANY expense transactions
    const allExpensesCount = await db.transaction.count({
      where: {
        userId: user.id,
        type: "EXPENSE",
      },
    });
    console.log(`Total expense transactions for user: ${allExpensesCount}`);

    // DEBUG STEP 3: Check for transactions in the current month
    const currentMonthCount = await db.transaction.count({
      where: {
        userId: user.id,
        type: "EXPENSE",
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });
    console.log(`Current month expense transactions: ${currentMonthCount}`);

    // Create where clause without accountId first
    const whereClause: Record<string, unknown> = {
      userId: user.id,
      type: "EXPENSE",
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    };

    // Only add accountId if it's a valid value
    if (accountId && accountId !== "undefined" && accountId !== "null") {
      whereClause.accountId = accountId;

      // DEBUG STEP 4: Check if there are any transactions for this specific account
      const accountTransactionsCount = await db.transaction.count({
        where: {
          userId: user.id,
          accountId,
        },
      });
      console.log(
        `Transactions for accountId ${accountId}: ${accountTransactionsCount}`
      );
    }

    // DEBUG STEP 5: Log the final where clause
    console.log("Final where clause for aggregate:", whereClause);

    // Run the actual expenses query
    const expenses = await db.transaction.aggregate({
      where: whereClause,
      _sum: {
        amount: true,
      },
    });

    // Debug - Log raw expenses result
    console.log("Raw expenses result:", expenses);

    // ALTERNATE APPROACH: If needed, get transactions directly to calculate sum manually
    if (!expenses._sum.amount) {
      console.log("No expenses found with aggregate, trying direct query...");
      const transactions = await db.transaction.findMany({
        where: whereClause,
        select: {
          amount: true,
        },
      });

      console.log(`Found ${transactions.length} transactions directly`);

      if (transactions.length > 0) {
        interface TransactionWithAmount {
          amount:
            | {
                toNumber(): number;
              }
            | number
            | string;
        }

        const manualSum: number = transactions.reduce(
          (sum: number, t: TransactionWithAmount): number =>
            sum +
            (typeof t.amount === "object" && "toNumber" in t.amount
              ? t.amount.toNumber()
              : Number(t.amount)),
          0
        );
        console.log(`Manual sum calculation: ${manualSum}`);

        return {
          budget: budget
            ? { ...budget, amount: budget.amount.toNumber() }
            : null,
          currentExpenses: manualSum,
        };
      }
    }

    // Return the standard result
    return {
      budget: budget ? { ...budget, amount: budget.amount.toNumber() } : null,
      currentExpenses: expenses._sum.amount
        ? expenses._sum.amount.toNumber()
        : 0,
    };
  } catch (error) {
    console.error("Error fetching budget:", error);
    throw error;
  }
}

export type BudgetResponse = {
  success: boolean;
  data?: {
    id: string;
    amount: number;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    lastAlertSent: Date | null;
  };
  error?: string;
};

export async function updateBudget(amount: number): Promise<BudgetResponse> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    const budget = await db.budget.upsert({
      where: {
        userId: user.id,
      },
      update: {
        amount,
      },
      create: {
        userId: user.id,
        amount,
      },
    });

    revalidatePath("/dashboard");
    return {
      success: true,
      data: {
        ...budget,
        amount:
          typeof budget.amount === "object" && "toNumber" in budget.amount
            ? budget.amount.toNumber()
            : Number(budget.amount),
      },
    };
  } catch (error) {
    console.error("Error updating budget:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update budget",
    };
  }
}
