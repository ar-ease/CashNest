"use server";
import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

// Define interfaces matching the Prisma schema
export type AccountType = "CURRENT" | "SAVINGS";

enum TransactionType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
}

enum RecurringInterval {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
}

enum TransactionStatus {
  COMPLETED = "COMPLETED",
  PENDING = "PENDING",
  CANCELLED = "CANCELLED",
}

// Define the expected structure for account creation data
interface CreateAccountData {
  name: string;
  balance: string | number;
  type: AccountType;
  isDefault?: boolean;
}

// Serialized versions of the interfaces (after processing Decimal and Date)
interface SerializedAccount {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  isDefault: boolean;
  userId: string;
  createdAt: string;
  transactions?: SerializedTransaction[];
  _count?: {
    transactions: number;
  };
}

interface SerializedTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  category: string;
  receiptUrl?: string;
  isRecurring: boolean;
  recurringInterval?: RecurringInterval;
  nextRecurringDate?: string;
  lastProcessed?: string;
  status: TransactionStatus;
  userId: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
}

type SerializedData<T> = T extends Date
  ? string
  : T extends Decimal
    ? number
    : T extends (infer U)[]
      ? SerializedData<U>[]
      : T extends object
        ? { [K in keyof T]: SerializedData<T[K]> }
        : T;

// Helper to properly serialize Decimal objects and other non-serializable data
const serializeTransaction = <T>(data: T): SerializedData<T> => {
  // Handle arrays by mapping through them
  if (Array.isArray(data)) {
    return data.map((item) => serializeTransaction(item)) as SerializedData<T>;
  }

  // Handle single objects
  if (data && typeof data === "object") {
    const serialized = { ...data } as Record<string, unknown>;

    // Handle Decimal fields
    if (
      "balance" in data &&
      data.balance &&
      typeof (data.balance as unknown as Decimal).toNumber === "function"
    ) {
      serialized.balance = (data.balance as unknown as Decimal).toNumber();
    }

    if (
      "amount" in data &&
      data.amount &&
      typeof (data.amount as unknown as Decimal).toNumber === "function"
    ) {
      serialized.amount = (data.amount as unknown as Decimal).toNumber();
    }

    // Handle dates
    for (const dateField of [
      "createdAt",
      "updatedAt",
      "date",
      "nextRecurringDate",
      "lastProcessed",
    ]) {
      if (dateField in data && data[dateField as keyof T] instanceof Date) {
        serialized[dateField] = (
          data[dateField as keyof T] as unknown as Date
        ).toISOString();
      }
    }

    // Recursively serialize nested objects
    Object.keys(serialized).forEach((key) => {
      if (
        serialized[key] &&
        typeof serialized[key] === "object" &&
        !Array.isArray(serialized[key])
      ) {
        serialized[key] = serializeTransaction(serialized[key] as unknown);
      } else if (Array.isArray(serialized[key])) {
        serialized[key] = serializeTransaction(serialized[key] as unknown);
      }
    });

    return serialized as SerializedData<T>;
  }

  // Return primitive values as-is
  return data as SerializedData<T>;
};

export async function createAccount(data: CreateAccountData): Promise<void> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("User not found");

    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });
    if (!user) throw new Error("User not found");

    const balanceFloat = parseFloat(data.balance as string);
    if (isNaN(balanceFloat)) throw new Error("Invalid balance");

    const existingAccount = await db.account.findMany({
      where: {
        userId: user.id,
      },
    });

    const shouldBeDefault =
      existingAccount.length === 0 ? true : !!data.isDefault;

    if (shouldBeDefault) {
      await db.account.updateMany({
        where: {
          userId: user.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // const account = await db.account.create({
    //   data: {
    //     name: data.name,
    //     type: data.type,
    //     balance: balanceFloat,
    //     userId: user.id,
    //     isDefault: shouldBeDefault,
    //   },
    // });

    // const serializedAccount = serializeTransaction(account);
    revalidatePath("/dashboard");
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("An unknown error occurred");
  }
}

export async function getUserAccount(): Promise<SerializedAccount[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("User not found");

  const user = await db.user.findUnique({
    where: {
      clerkUserId: userId,
    },
  });
  if (!user) throw new Error("User not found");

  const accounts = await db.account.findMany({
    where: {
      userId: user.id,
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { transactions: true },
      },
    },
  });

  const serializedAccount = serializeTransaction(accounts);
  return serializedAccount as SerializedAccount[];
}

export async function getDashboardData(): Promise<SerializedTransaction[]> {
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
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return serializeTransaction(transactions) as SerializedTransaction[];
}
