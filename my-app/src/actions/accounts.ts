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
// export async function bulkDeleteTransaction(transactionIds: string[]) {
//   try {
//     const { userId } = await auth();
//     if (!userId) throw new Error("User not found");

//     const user = await db.user.findUnique({
//       where: {
//         clerkUserId: userId,
//       },
//     });

//     if (!user) throw new Error("User not found");
//     const transactions = await db.transaction.findMany({
//       where: {
//         id: { in: transactionIds },
//         userId: user.id,
//       },
//     });
//     if (!transactions) throw new Error("Transaction not found");

//     const AccountBalanceChanges = transactions.reduce((acc, transaction) => {
//       const change =
//         transaction.type === "EXPENSE"
//           ? transaction.amount
//           : -transaction.amount;
//       acc[transaction.accountId] = (acc[transaction.accountId] || 0) + change;
//     }, {});

//     await db.$transaction(async (tx) => {
//       await tx.transaction.deleteMany({
//         where: {
//           id: { in: transactionIds },
//           userId: user.id,
//         },
//       });
//       for (const [accountId, balanceChange] of Object.entries(
//         AccountBalanceChanges
//       )) {
//         await tx.account.update({
//           where: {
//             id: accountId,
//           },
//           data: {
//             balance: {
//               increment: balanceChange,
//             },
//           },
//         });
//       }
//     });

//     revalidatePath("/dashboard");
//     revalidatePath("/account/[id]");
//   } catch (error) {}
// }

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
