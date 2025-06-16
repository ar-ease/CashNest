"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

// Database transaction client type
type DatabaseTransaction = Parameters<Parameters<typeof db.$transaction>[0]>[0];

// Generic helper to safely convert Prisma Decimal
const toNumber = (value: unknown): number =>
  value instanceof Decimal ? value.toNumber() : (value as number);

// Define the Account type based on your Prisma schema
interface Account {
  id: string;
  name: string;
  type: "CURRENT" | "SAVINGS";
  balance: Decimal;
  isDefault: boolean;
  userId: string;
  createdAt: Date;
}

// Transaction type for database operations
interface Transaction {
  id: string;
  type: string;
  amount: Decimal;
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

// Serialized types for client responses
interface SerializedAccount {
  [key: string]: unknown;
  id: string;
  name: string;
  type: "CURRENT" | "SAVINGS";
  balance: number;
  isDefault: boolean;
  userId: string;
  createdAt: Date;
}

interface SerializedTransaction {
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
}

// Account with transactions type
interface AccountWithTransactions {
  id: string;
  name: string;
  type: "CURRENT" | "SAVINGS";
  balance: number;
  isDefault: boolean;
  userId: string;
  createdAt: Date;
  transactions: SerializedTransaction[];
  _count: {
    transactions: number;
  };
}

// Response types
interface SerializedAccountData {
  [key: string]: unknown;
  balance?: number;
  amount?: number;
}

interface UpdateAccountResponse {
  success: boolean;
  data?: SerializedAccountData;
  error?: string;
}

interface BulkDeleteResponse {
  success: boolean;
  message?: string;
}

// Account balance changes tracking
interface AccountBalanceChanges {
  [accountId: string]: number;
}

// Update the serialization helper with proper typing
const serializeAccount = (account: Account): SerializedAccount => ({
  ...account,
  balance: toNumber(account.balance),
});

// Serialize transaction helper
const serializeTransaction = (
  transaction: Transaction
): SerializedTransaction => ({
  ...transaction,
  amount: toNumber(transaction.amount),
});

// Update default account function
export async function updateDefaultAccount(
  accountId: string
): Promise<UpdateAccountResponse> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("User not found");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) throw new Error("User not found");

    const account = await db.$transaction(async (tx: DatabaseTransaction) => {
      // Set current default to false
      await tx.account.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });

      // Set new default
      const updatedAccount = await tx.account.update({
        where: { id: accountId, userId: user.id },
        data: { isDefault: true },
      });

      return updatedAccount as Account;
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

// Get account with transactions
export async function getAccountWithTransactions(
  accountId: string
): Promise<AccountWithTransactions | null> {
  try {
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

    // Type assertion for Prisma result with includes
    const accountWithIncludes = account as Account & {
      transactions: Transaction[];
      _count: { transactions: number };
    };

    return {
      ...accountWithIncludes,
      balance: toNumber(accountWithIncludes.balance),
      transactions: accountWithIncludes.transactions.map(
        (transaction: Transaction) => serializeTransaction(transaction)
      ),
    };
  } catch (error) {
    console.error("Error fetching account with transactions:", error);
    return null;
  }
}

// Bulk delete transactions
export async function bulkDeleteTransaction(
  transactionIds: string[]
): Promise<BulkDeleteResponse> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("User not found");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) throw new Error("User not found");

    // Validate input
    if (!transactionIds.length) {
      throw new Error("No transaction IDs provided");
    }

    // Get transactions to calculate balance changes
    const transactions = await db.transaction.findMany({
      where: {
        id: { in: transactionIds },
        userId: user.id,
      },
    });

    if (!transactions.length) {
      throw new Error("Transactions not found");
    }

    // Calculate balance changes for each account
    const accountBalanceChanges: AccountBalanceChanges = {};

    transactions.forEach((transaction: Transaction) => {
      const amount = toNumber(transaction.amount);
      // Reverse the transaction: if it was EXPENSE, add back; if INCOME, subtract
      const delta = transaction.type === "EXPENSE" ? amount : -amount;

      accountBalanceChanges[transaction.accountId] =
        (accountBalanceChanges[transaction.accountId] || 0) + delta;
    });

    // Perform bulk delete and account updates in a transaction
    await db.$transaction(async (tx: DatabaseTransaction) => {
      // Delete all transactions
      await tx.transaction.deleteMany({
        where: {
          id: { in: transactionIds },
          userId: user.id,
        },
      });

      // Update account balances
      const balanceUpdates = Object.entries(accountBalanceChanges).map(
        ([accountId, balanceChange]: [string, number]) =>
          tx.account.update({
            where: { id: accountId },
            data: {
              balance: { increment: balanceChange },
            },
          })
      );

      await Promise.all(balanceUpdates);
    });

    revalidatePath("/dashboard");

    // Revalidate affected account pages
    const affectedAccountIds = Object.keys(accountBalanceChanges);
    affectedAccountIds.forEach((accountId: string) => {
      revalidatePath(`/account/${accountId}`);
    });

    return {
      success: true,
      message: `Successfully deleted ${transactions.length} transaction(s)`,
    };
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

// Additional helper function to get account balance
export async function getAccountBalance(
  accountId: string
): Promise<number | null> {
  try {
    const { userId } = await auth();
    if (!userId) return null;

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) return null;

    const account = await db.account.findUnique({
      where: { id: accountId, userId: user.id },
      select: { balance: true },
    });

    if (!account) return null;

    return toNumber(account.balance);
  } catch (error) {
    console.error("Error fetching account balance:", error);
    return null;
  }
}

// Recalculate account balance from transactions (useful for data integrity)
export async function recalculateAccountBalance(
  accountId: string
): Promise<UpdateAccountResponse> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("User not found");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) throw new Error("User not found");

    const account = await db.$transaction(async (tx: DatabaseTransaction) => {
      // Get all transactions for this account
      const transactions = await tx.transaction.findMany({
        where: { accountId, userId: user.id },
        select: { type: true, amount: true },
      });

      // Calculate correct balance
      let correctBalance = 0;
      transactions.forEach((transaction: { type: string; amount: Decimal }) => {
        const amount = toNumber(transaction.amount);
        if (transaction.type === "INCOME") {
          correctBalance += amount;
        } else if (transaction.type === "EXPENSE") {
          correctBalance -= amount;
        }
      });

      // Update account with correct balance
      const updatedAccount = await tx.account.update({
        where: { id: accountId, userId: user.id },
        data: { balance: new Decimal(correctBalance) },
      });

      return updatedAccount as Account;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${accountId}`);

    return {
      success: true,
      data: serializeAccount(account),
    };
  } catch (error) {
    console.error("Error recalculating account balance:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to recalculate balance",
    };
  }
}
