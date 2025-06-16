"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";
import aj from "@/lib/arcjet";
import { request } from "@arcjet/next";
import {
  Transaction,
  TransactionType,
  RecurringInterval,
  TransactionStatus,
} from "@/types/transactionType";
import { Account } from "@/types/accountType";
import { Decimal } from "@prisma/client/runtime/library";

// Database transaction client type
type DatabaseTransaction = Parameters<Parameters<typeof db.$transaction>[0]>[0];

// Extended types for database operations
type TransactionWithAccount = Transaction & {
  account: Account;
};

// Serialized Transaction type for client responses
type SerializedTransaction = Omit<Transaction, "amount"> & {
  amount: number;
};

type SerializedTransactionWithAccount = Omit<
  TransactionWithAccount,
  "amount"
> & {
  amount: number;
  account: Omit<Account, "balance"> & { balance: number };
};

// Input/Output interfaces
interface TransactionData {
  accountId: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  date: Date;
  isRecurring?: boolean;
  recurringInterval?: RecurringInterval | null;
  receiptUrl?: string;
  status?: TransactionStatus;
}

interface TransactionCreateData {
  type: TransactionType;
  amount: Decimal;
  description: string;
  date: Date;
  category: string;
  isRecurring: boolean;
  recurringInterval: RecurringInterval | null;
  userId: string;
  accountId: string;
  nextRecurringDate: Date | null;
  receiptUrl?: string | null;
  status: TransactionStatus;
}

interface TransactionUpdateData {
  type?: TransactionType;
  amount?: Decimal;
  description?: string;
  date?: Date;
  category?: string;
  isRecurring?: boolean;
  recurringInterval?: RecurringInterval | null;
  accountId?: string;
  nextRecurringDate?: Date | null;
  receiptUrl?: string | null;
  status?: TransactionStatus;
}

interface ReceiptData {
  amount: number;
  date: Date;
  description: string;
  category: string;
  merchantName: string;
}

interface TransactionResponse {
  success: boolean;
  data: SerializedTransaction;
}

interface TransactionsListResponse {
  success: boolean;
  data: SerializedTransaction[];
}

// Query interfaces for filtering
interface TransactionQuery {
  type?: TransactionType;
  category?: string;
  accountId?: string;
  isRecurring?: boolean;
  status?: TransactionStatus;
  date?: {
    gte?: Date;
    lte?: Date;
  };
  amount?: {
    gte?: number;
    lte?: number;
  };
}

// Where clause types for queries
interface TransactionWhereInput {
  userId?: string;
  type?: TransactionType;
  category?: string;
  accountId?: string;
  isRecurring?: boolean;
  status?: TransactionStatus;
  date?: {
    gte?: Date;
    lte?: Date;
  };
  amount?: {
    gte?: Decimal;
    lte?: Decimal;
  };
}

// Aggregate query result types
interface TransactionAggregateResult {
  _sum: {
    amount: Decimal | null;
  };
}

interface TransactionStatsResponse {
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
  balance: number;
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Helper function to serialize Decimal amounts to numbers
const serializeTransaction = (
  transaction: Transaction
): SerializedTransaction => ({
  ...transaction,
  amount: transaction.amount.toNumber(),
});

// Helper function to serialize transaction with account
const serializeTransactionWithAccount = (
  transaction: TransactionWithAccount
): SerializedTransactionWithAccount => ({
  ...transaction,
  amount: transaction.amount.toNumber(),
  account: {
    ...transaction.account,
    balance: transaction.account.balance,
  },
});

// Helper function to serialize multiple transactions
const serializeTransactions = (
  transactions: Transaction[]
): SerializedTransaction[] => transactions.map(serializeTransaction);

// Create Transaction
export async function createTransaction(
  data: TransactionData
): Promise<TransactionResponse> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const req = await request();

    const decision = await aj.protect(req, {
      userId,
      requested: 1,
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        const { remaining, reset } = decision.reason;
        console.error({
          code: "RATE_LIMIT_EXCEEDED",
          details: {
            remaining,
            resetInSeconds: reset,
          },
        });

        throw new Error("Too many requests. Please try again later.");
      }

      throw new Error("Request blocked");
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    const account = await db.account.findUnique({
      where: {
        id: data.accountId,
        userId: user.id,
      },
    });

    if (!account) throw new Error("Account not found");

    const balanceChange = data.type === "EXPENSE" ? -data.amount : data.amount;
    const newBalance = account.balance.toNumber() + balanceChange;

    const transactionCreateData: TransactionCreateData = {
      type: data.type,
      amount: new Decimal(data.amount),
      description: data.description,
      date: data.date,
      category: data.category,
      isRecurring: data.isRecurring || false,
      recurringInterval: data.recurringInterval || null,
      userId: user.id,
      accountId: data.accountId,
      receiptUrl: data.receiptUrl || null,
      status: data.status || "COMPLETED",
      nextRecurringDate:
        data.isRecurring && data.recurringInterval
          ? calculateNextRecurringDate(data.date, data.recurringInterval)
          : null,
    };

    const transaction = await db.$transaction(
      async (tx: DatabaseTransaction) => {
        const newTransaction = await tx.transaction.create({
          data: transactionCreateData,
        });

        await tx.account.update({
          where: { id: data.accountId },
          data: { balance: new Decimal(newBalance) },
        });

        return newTransaction as Transaction;
      }
    );

    revalidatePath("/dashboard");
    revalidatePath(`/account/${transaction.accountId}`);

    return { success: true, data: serializeTransaction(transaction) };
  } catch (error) {
    console.error("Error creating transaction:", error);
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("An unknown error occurred");
  }
}

export async function getTransaction(
  id: string
): Promise<SerializedTransaction | null> {
  console.log("Getting transaction with ID:", id);
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    const transaction = await db.transaction.findUnique({
      where: {
        id,
        userId: user.id,
      },
    });

    console.log("Transaction found:", transaction);

    if (!transaction) return null;

    return serializeTransaction(transaction as Transaction);
  } catch (error) {
    console.error("Error in getTransaction:", error);
    return null;
  }
}

export async function getTransactionWithAccount(
  id: string
): Promise<SerializedTransactionWithAccount | null> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    const transaction = await db.transaction.findUnique({
      where: {
        id,
        userId: user.id,
      },
      include: {
        account: true,
      },
    });

    if (!transaction) return null;

    return serializeTransactionWithAccount(
      transaction as unknown as TransactionWithAccount
    );
  } catch (error) {
    console.error("Error in getTransactionWithAccount:", error);
    return null;
  }
}

export async function updateTransaction(
  id: string,
  data: TransactionData
): Promise<TransactionResponse> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // First, get the original transaction to calculate balance changes
    const originalTransaction = await db.transaction.findUnique({
      where: { id, userId: user.id },
      include: { account: true },
    });

    if (!originalTransaction) throw new Error("Transaction not found");

    const balanceChange = data.type === "EXPENSE" ? -data.amount : data.amount;
    const originalBalanceChange =
      originalTransaction.type === "EXPENSE"
        ? originalTransaction.amount.toNumber()
        : -originalTransaction.amount.toNumber();

    const netBalanceChange = balanceChange + originalBalanceChange;
    const newBalance =
      originalTransaction.account.balance.toNumber() + netBalanceChange;

    const transactionUpdateData: TransactionUpdateData = {
      type: data.type,
      amount: new Decimal(data.amount),
      description: data.description,
      date: data.date,
      category: data.category,
      isRecurring: data.isRecurring || false,
      recurringInterval: data.recurringInterval || null,
      accountId: data.accountId,
      receiptUrl: data.receiptUrl || null,
      status: data.status || "COMPLETED",
      nextRecurringDate:
        data.isRecurring && data.recurringInterval
          ? calculateNextRecurringDate(data.date, data.recurringInterval)
          : null,
    };

    const transaction = await db.$transaction(
      async (tx: DatabaseTransaction) => {
        const updatedTransaction = await tx.transaction.update({
          where: { id, userId: user.id },
          data: transactionUpdateData,
        });

        // Handle account switching
        if (data.accountId !== originalTransaction.accountId) {
          // Remove from old account
          await tx.account.update({
            where: { id: originalTransaction.accountId },
            data: {
              balance: new Decimal(
                originalTransaction.account.balance.toNumber() +
                  originalBalanceChange
              ),
            },
          });

          // Add to new account
          const newAccount = await tx.account.findUnique({
            where: { id: data.accountId, userId: user.id },
          });

          if (!newAccount) throw new Error("New account not found");

          await tx.account.update({
            where: { id: data.accountId },
            data: {
              balance: new Decimal(
                newAccount.balance.toNumber() + balanceChange
              ),
            },
          });
        } else {
          // Update same account balance
          await tx.account.update({
            where: { id: data.accountId },
            data: { balance: new Decimal(newBalance) },
          });
        }

        return updatedTransaction as Transaction;
      }
    );

    revalidatePath(`/transaction/${id}`);
    revalidatePath("/dashboard");
    revalidatePath(`/account/${transaction.accountId}`);
    if (originalTransaction.accountId !== transaction.accountId) {
      revalidatePath(`/account/${originalTransaction.accountId}`);
    }

    return { success: true, data: serializeTransaction(transaction) };
  } catch (error) {
    console.error("Error updating transaction:", error);
    throw new Error("Failed to update transaction");
  }
}

export async function getUserTransactions(
  queryParams: TransactionQuery = {}
): Promise<TransactionsListResponse> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Build where clause for filtering
    const where: TransactionWhereInput = {
      userId: user.id,
      ...(queryParams.type && { type: queryParams.type }),
      ...(queryParams.category && { category: queryParams.category }),
      ...(queryParams.accountId && { accountId: queryParams.accountId }),
      ...(queryParams.isRecurring !== undefined && {
        isRecurring: queryParams.isRecurring,
      }),
      ...(queryParams.status && { status: queryParams.status }),
      ...(queryParams.date && { date: queryParams.date }),
      ...(queryParams.amount && {
        amount: {
          ...(queryParams.amount.gte && {
            gte: new Decimal(queryParams.amount.gte),
          }),
          ...(queryParams.amount.lte && {
            lte: new Decimal(queryParams.amount.lte),
          }),
        },
      }),
    };

    const transactions = await db.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        account: true,
      },
    });

    return {
      success: true,
      data: serializeTransactions(transactions as unknown as Transaction[]),
    };
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return { success: false, data: [] };
  }
}

export async function deleteTransaction(
  id: string
): Promise<{ success: boolean }> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    const transaction = await db.transaction.findUnique({
      where: { id, userId: user.id },
      include: { account: true },
    });

    if (!transaction) throw new Error("Transaction not found");

    // Reverse the balance change
    const balanceChange =
      transaction.type === "EXPENSE"
        ? transaction.amount.toNumber()
        : -transaction.amount.toNumber();

    const newBalance = transaction.account.balance.toNumber() + balanceChange;

    await db.$transaction(async (tx: DatabaseTransaction) => {
      await tx.transaction.delete({
        where: { id, userId: user.id },
      });

      await tx.account.update({
        where: { id: transaction.accountId },
        data: { balance: new Decimal(newBalance) },
      });
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${transaction.accountId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting transaction:", error);
    throw new Error("Failed to delete transaction");
  }
}

export async function scanReceipt(file: File): Promise<ReceiptData> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    // Convert ArrayBuffer to Base64
    const base64String = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `
      Analyze this receipt image and extract the following information in JSON format:
      - Total amount (just the number)
      - Date (in ISO format)
      - Description or items purchased (brief summary)
      - Merchant/store name
      - Suggested category (one of: housing,transportation,groceries,utilities,entertainment,food,shopping,healthcare,education,personal,travel,insurance,gifts,bills,other-expense )
      
      Only respond with valid JSON in this exact format:
      {
        "amount": number,
        "date": "ISO date string",
        "description": "string",
        "merchantName": "string",
        "category": "string"
      }

      If it's not a receipt, return an empty object {}
    `;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    try {
      const data = JSON.parse(cleanedText);

      // Validate the response
      if (!data.amount || !data.date || !data.description) {
        throw new Error("Invalid receipt data extracted");
      }

      return {
        amount: parseFloat(data.amount),
        date: new Date(data.date),
        description: data.description,
        category: data.category,
        merchantName: data.merchantName,
      };
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      throw new Error("Invalid response format from Gemini");
    }
  } catch (error) {
    console.error("Error scanning receipt:", error);
    throw new Error("Failed to scan receipt");
  }
}

// Utility function to get transaction statistics
export async function getTransactionStats(
  accountId?: string
): Promise<TransactionStatsResponse> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    const where: TransactionWhereInput = {
      userId: user.id,
      ...(accountId && { accountId }),
    };

    const [income, expenses, count] = await Promise.all([
      db.transaction.aggregate({
        where: { ...where, type: "INCOME" },
        _sum: { amount: true },
      }) as Promise<TransactionAggregateResult>,
      db.transaction.aggregate({
        where: { ...where, type: "EXPENSE" },
        _sum: { amount: true },
      }) as Promise<TransactionAggregateResult>,
      db.transaction.count({ where }),
    ]);

    const totalIncome: number = income._sum.amount?.toNumber() || 0;
    const totalExpenses: number = expenses._sum.amount?.toNumber() || 0;

    return {
      totalIncome,
      totalExpenses,
      transactionCount: count,
      balance: totalIncome - totalExpenses,
    };
  } catch (error) {
    console.error("Error getting transaction stats:", error);
    throw new Error("Failed to get transaction statistics");
  }
}

function calculateNextRecurringDate(
  startDate: Date,
  interval: RecurringInterval
): Date {
  const date = new Date(startDate);

  switch (interval) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      break;
    case "YEARLY":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date;
}
