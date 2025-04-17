"use server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const serializeTransaction = (obj: any) => {
  const serialized = { ...obj };

  if (obj.balance) {
    serialized.balance = obj.balance.toNumber();
  }
  if (obj.amount) {
    serialized.balance = obj.balance.toNumber();
  }
  return serialized;
};

export async function updateDefaultAccount(accountId: string) {
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
export async function getAccountWithTransactions(accountId: string) {
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
    balance: account.balance,
    transactions: account.transactions.map((t) => ({
      ...t,
      amount: t.amount.toNumber(), // <- convert Decimal to number
    })),
  };
}
export async function bulkDeleteTransaction(transactionIds: string) {}
