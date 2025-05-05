"use server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

// Create more specific types
interface AccountData {
  balance?: Decimal;
  amount?: Decimal;
  [key: string]: unknown;
}

interface SerializedAccountData {
  [key: string]: unknown;
  balance?: number;
  amount?: number;
}

const serializeTransaction = (obj: AccountData): SerializedAccountData => {
  const { ...rest } = obj;
  const serialized: SerializedAccountData = {};

  if (rest.balance) {
    serialized.balance = rest.balance?.toNumber();
  }
  if (rest.amount) {
    serialized.amount = rest.amount?.toNumber();
  }
  return serialized;
};

export async function updateDefaultAccount(accountId: string): Promise<{
  success: boolean;
  data?: SerializedAccountData;
  error?: string;
}> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("User not found");

    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });
    if (!user) throw new Error("User not found");

    await db.account.updateMany({
      where: {
        userId: user.id,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    const account = await db.account.update({
      where: {
        id: accountId,
        userId: user.id,
      },
      data: {
        isDefault: true,
      },
    });
    if (!account) throw new Error("Account not found");

    revalidatePath("/dashboard");

    return { success: true, data: serializeTransaction(account) };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// Define a more specific return type for getAccountWithTransactions
interface AccountWithTransactions {
  id: string;
  name: string;
  type: string;
  balance: number; // Converted from Decimal
  isDefault: boolean;
  userId: string;
  createdAt: Date;
  transactions: Array<{
    id: string;
    type: string;
    amount: number; // Converted from Decimal
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
    where: {
      clerkUserId: userId,
    },
  });
  if (!user) throw new Error("User not found");

  const account = await db.account.findUnique({
    where: { id: accountId, userId: user.id },
    include: {
      transactions: {
        orderBy: {
          createdAt: "desc",
        },
      },
      _count: {
        select: {
          transactions: true,
        },
      },
    },
  });

  if (!account) return null;

  return {
    ...account,
    balance: account.balance.toNumber(),
    transactions: account.transactions.map((t) => ({
      ...t,
      amount: t.amount.toNumber(), // Convert Decimal to number
    })),
  };
}

export async function bulkDeleteTransaction(
  transactionIds: string[]
): Promise<{ success: boolean; message?: string }> {
  type AccountBalanceMap = {
    [accountId: string]: number;
  };
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("User not found");

    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });
    if (!user) throw new Error("User not found");

    const transactions = await db.transaction.findMany({
      where: {
        id: { in: transactionIds },
        userId: user.id,
      },
    });
    if (!transactions.length) throw new Error("Transactions not found");

    const accountBalanceChanges: AccountBalanceMap = transactions.reduce(
      (acc: AccountBalanceMap, transaction) => {
        // For expenses, we need to add back to the balance when deleting
        // For income, we need to subtract from the balance when deleting
        const change =
          transaction.type === "EXPENSE"
            ? transaction.amount
            : -transaction.amount;

        acc[transaction.accountId] =
          (acc[transaction.accountId] || 0) +
          (typeof change === "object" && "toNumber" in change
            ? change.toNumber()
            : change);
        return acc; // This return was missing
      },
      {}
    );

    await db.$transaction(async (tx) => {
      await tx.transaction.deleteMany({
        where: {
          id: { in: transactionIds },
          userId: user.id,
        },
      });

      for (const [accountId, balanceChange] of Object.entries(
        accountBalanceChanges
      )) {
        await tx.account.update({
          where: {
            id: accountId,
          },
          data: {
            balance: {
              increment: balanceChange,
            },
          },
        });
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/account/[id]");

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
