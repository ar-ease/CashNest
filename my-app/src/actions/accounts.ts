"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

// Generic helper to safely convert Prisma Decimal
const toNumber = (value: unknown): number =>
  value instanceof Decimal ? value.toNumber() : (value as number);

// Define the Account type based on your Prisma schema
type Account = {
  id: string;
  name: string;
  type: "CURRENT" | "SAVINGS";
  balance: Decimal;
  isDefault: boolean;
  userId: string;
  createdAt: Date;
};

// Update the serialization helper with proper typing
const serializeAccount = (account: Account) => ({
  ...account,
  balance: toNumber(account.balance),
});

// Types
interface SerializedAccountData {
  [key: string]: unknown;
  balance?: number;
  amount?: number;
}

export async function updateDefaultAccount(accountId: string): Promise<{
  success: boolean;
  data?: SerializedAccountData;
  error?: string;
}> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("User not found");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) throw new Error("User not found");

    // Set current default to false
    await db.account.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });

    // Set new default
    const account = await db.account.update({
      where: { id: accountId, userId: user.id },
      data: { isDefault: true },
    });

    if (!account) throw new Error("Account not found");

    revalidatePath("/dashboard");
    revalidatePath(`/account/${accountId}`);

    return { success: true, data: serializeAccount(account) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Full account + transactions return type
interface AccountWithTransactions {
  id: string;
  name: string;
  type: string;
  balance: number;
  isDefault: boolean;
  userId: string;
  createdAt: Date;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    date: Date;
    category: string;
    receiptUrl?: string | null;
    isRecurring: boolean;
    recurringInterval?: string | null;
    nextRecurringDate?: Date | null;
    lastProcessed?: Date | null;
    status: string;
    userId: string;
    accountId: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  _count: {
    transactions: number;
  };
}

export async function getAccountWithTransactions(
  accountId: string
): Promise<AccountWithTransactions | null> {
  const { userId } = await auth();
  if (!userId) throw new Error("User not found");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });
  if (!user) throw new Error("User not found");

  const account = await db.account.findUnique({
    where: { id: accountId, userId: user.id },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { transactions: true },
      },
    },
  });

  if (!account) return null;

  // Define type for transaction from Prisma (with Decimal)
  interface PrismaTransaction {
    id: string;
    type: string;
    amount: Decimal | number;
    description: string;
    date: Date;
    category: string;
    receiptUrl?: string | null;
    isRecurring: boolean;
    recurringInterval?: string | null;
    nextRecurringDate?: Date | null;
    lastProcessed?: Date | null;
    status: string;
    userId: string;
    accountId: string;
    createdAt: Date;
    updatedAt: Date;
  }

  // Define type for account from Prisma (with Decimal)
  interface PrismaAccount {
    id: string;
    name: string;
    type: string;
    balance: Decimal | number;
    isDefault: boolean;
    userId: string;
    createdAt: Date;
    transactions: PrismaTransaction[];
    _count: {
      transactions: number;
    };
  }

  // Cast the account to the correct Prisma type
  const prismaAccount = account as unknown as PrismaAccount;

  return {
    ...prismaAccount,
    balance: toNumber(prismaAccount.balance),
    transactions: prismaAccount.transactions.map((t: PrismaTransaction) => ({
      ...t,
      amount: toNumber(t.amount),
    })),
  };
}

export async function bulkDeleteTransaction(
  transactionIds: string[]
): Promise<{ success: boolean; message?: string }> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("User not found");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) throw new Error("User not found");

    const transactions = await db.transaction.findMany({
      where: {
        id: { in: transactionIds },
        userId: user.id,
      },
    });

    if (!transactions.length) throw new Error("Transactions not found");

    const accountBalanceChanges: Record<string, number> = {};

    for (const tx of transactions) {
      const amount = toNumber(tx.amount);
      const delta = tx.type === "EXPENSE" ? amount : -amount;
      accountBalanceChanges[tx.accountId] =
        (accountBalanceChanges[tx.accountId] || 0) + delta;
    }

    // Use Prisma's transaction client directly without custom interface
    await db.$transaction(async (tx) => {
      await tx.transaction.deleteMany({
        where: {
          id: { in: transactionIds },
          userId: user.id,
        },
      });

      for (const [accountId, balanceChange] of Object.entries(
        accountBalanceChanges
      ) as Array<[string, number]>) {
        await tx.account.update({
          where: { id: accountId },
          data: {
            balance: { increment: balanceChange },
          },
        });
      }
    });

    revalidatePath("/dashboard");
    // Optional: revalidate specific account pages if needed
    return { success: true };
  } catch (error) {
    console.error("Error deleting transactions:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete transactions",
    };
  }
}
