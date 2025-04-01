"use server";
import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

// Helper to properly serialize Decimal objects and other non-serializable data
const serializeTransaction = (data: any): any => {
  // Handle arrays by mapping through them
  if (Array.isArray(data)) {
    return data.map((item) => serializeTransaction(item));
  }

  // Handle single objects
  if (data && typeof data === "object") {
    const serialized = { ...data };

    // Handle Decimal fields
    if (data.balance && typeof data.balance.toNumber === "function") {
      serialized.balance = data.balance.toNumber();
    }

    if (data.amount && typeof data.amount.toNumber === "function") {
      serialized.amount = data.amount.toNumber();
    }

    // Handle dates
    if (data.createdAt instanceof Date) {
      serialized.createdAt = data.createdAt.toISOString();
    }

    // Recursively serialize nested objects
    Object.keys(serialized).forEach((key) => {
      if (
        serialized[key] &&
        typeof serialized[key] === "object" &&
        !Array.isArray(serialized[key])
      ) {
        serialized[key] = serializeTransaction(serialized[key]);
      } else if (Array.isArray(serialized[key])) {
        serialized[key] = serializeTransaction(serialized[key]);
      }
    });

    return serialized;
  }

  return data;
};
export async function createAccount(data: any) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("User not found");

    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });
    if (!user) throw new Error("User not found");

    const balanceFloat = parseFloat(data.balance);
    if (isNaN(balanceFloat)) throw new Error("Invalid balance");

    const existingAccount = await db.account.findMany({
      where: {
        userId: user.id,
      },
    });

    const shouldBeDefault =
      existingAccount.length === 0 ? true : data.isDefault;

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

    const account = await db.account.create({
      data: {
        ...data,
        balance: balanceFloat,
        userId: user.id,
        isDefault: shouldBeDefault,
      },
    });

    const serializedAccount = serializeTransaction(account);
    revalidatePath("/dashboard");
  } catch (error: any) {
    throw new Error(error.message);
  }
}
export async function getUserAccount() {
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
  return serializedAccount;
}
