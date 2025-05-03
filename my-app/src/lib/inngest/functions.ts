import { db } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { inngest } from "./client";
import { sendEmail } from "@/actions/send-email";
import EmailTemplate from "../../../emails/template";
import { Decimal } from "@prisma/client/runtime/library";

// Define types
type TransactionType = "EXPENSE" | "INCOME";
type RecurringInterval = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

interface Transaction {
  id: string;
  type: TransactionType;
  amount: Decimal;
  description: string;
  date: Date;
  category: string;
  userId: string;
  accountId: string;
  isRecurring: boolean;
  recurringInterval?: RecurringInterval | null;
  nextRecurringDate?: Date | null;
  lastProcessed?: Date | null;
  status?: string;
  account?: Account;
}

interface Account {
  id: string;
  name: string;
  balance: Decimal;
  isDefault?: boolean;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  accounts: Account[];
}

interface Budget {
  id: string;
  userId: string;
  amount: Decimal;
  lastAlertSent: Date | null;
  user: User;
}

interface EventData {
  transactionId: string;
  userId: string;
}

interface MonthlyStats {
  totalExpenses: number;
  totalIncome: number;
  byCategory: Record<string, number>;
  transactionCount: number;
}

interface EmailResult {
  success: boolean;
  error?: string;
}

export const processRecurringTransaction = inngest.createFunction(
  {
    id: "process-recurring-transaction",
    name: "Process Recurring Transaction",
    throttle: {
      limit: 10, // Process 10 transactions
      period: "1m", // per minute
      key: "event.data.userId", // Throttle per user
    },
  },
  { event: "transaction.recurring.process" },
  async ({
    event,
    step,
  }: {
    event: { data: EventData };
    step: {
      run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
    };
  }) => {
    // Validate event data
    if (!event?.data?.transactionId || !event?.data?.userId) {
      console.error("Invalid event data:", event);
      return { error: "Missing required event data" };
    }

    return await step.run("process-transaction", async () => {
      const transaction = (await db.transaction.findUnique({
        where: {
          id: event.data.transactionId,
          userId: event.data.userId,
        },
        include: {
          account: true,
        },
      })) as Transaction | null;

      if (
        !transaction ||
        !transaction.nextRecurringDate ||
        !isTransactionDue({
          lastProcessed: transaction.lastProcessed,
          nextRecurringDate: transaction.nextRecurringDate,
        })
      )
        return {
          status: "skipped",
          reason: "Transaction not due or not found",
        };

      // Create new transaction and update account balance in a transaction
      await db.$transaction(async (tx) => {
        // Create new transaction
        await tx.transaction.create({
          data: {
            type: transaction.type,
            amount: transaction.amount,
            description: `${transaction.description} (Recurring)`,
            date: new Date(),
            category: transaction.category,
            userId: transaction.userId,
            accountId: transaction.accountId,
            isRecurring: false,
          },
        });

        // Update account balance
        const balanceChange =
          transaction.type === "EXPENSE"
            ? -transaction.amount.toNumber()
            : transaction.amount.toNumber();

        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: balanceChange } },
        });

        // Update last processed date and next recurring date
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            lastProcessed: new Date(),
            nextRecurringDate: calculateNextRecurringDate(
              new Date(),
              transaction.recurringInterval as RecurringInterval
            ),
          },
        });
      });

      return { status: "processed", transactionId: transaction.id };
    });
  }
);

// Trigger recurring transactions with batching
export const triggerRecurringTransactions = inngest.createFunction(
  {
    id: "trigger-recurring-transactions", // Unique ID,
    name: "Trigger Recurring Transactions",
  },
  { cron: "0 0 * * *" }, // Daily at midnight
  async ({
    step,
  }: {
    step: {
      run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
    };
  }) => {
    const recurringTransactions = await step.run(
      "fetch-recurring-transactions",
      async () => {
        return (await db.transaction.findMany({
          where: {
            isRecurring: true,
            status: "COMPLETED",
            OR: [
              { lastProcessed: null },
              {
                nextRecurringDate: {
                  lte: new Date(),
                },
              },
            ],
          },
        })) as Transaction[];
      }
    );

    // Send event for each recurring transaction in batches
    if (recurringTransactions.length > 0) {
      const events = recurringTransactions.map((transaction) => ({
        name: "transaction.recurring.process",
        data: {
          transactionId: transaction.id,
          userId: transaction.userId,
        },
      }));

      // Send events directly using inngest.send()
      await inngest.send(events);
    }

    return { triggered: recurringTransactions.length };
  }
);

// 2. Monthly Report Generation
async function generateFinancialInsights(
  stats: MonthlyStats,
  month: string
): Promise<string[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Analyze this financial data and provide 3 concise, actionable insights.
    Focus on spending patterns and practical advice.
    Keep it friendly and conversational.

    Financial Data for ${month}:
    - Total Income: $${stats.totalIncome}
    - Total Expenses: $${stats.totalExpenses}
    - Net Income: $${stats.totalIncome - stats.totalExpenses}
    - Expense Categories: ${Object.entries(stats.byCategory)
      .map(([category, amount]) => `${category}: $${amount}`)
      .join(", ")}

    Format the response as a JSON array of strings, like this:
    ["insight 1", "insight 2", "insight 3"]
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error generating insights:", error);
    return [
      "Your highest expense category this month might need attention.",
      "Consider setting up a budget for better financial management.",
      "Track your recurring expenses to identify potential savings.",
    ];
  }
}

export const generateMonthlyReports = inngest.createFunction(
  {
    id: "generate-monthly-reports",
    name: "Generate Monthly Reports",
  },
  { cron: "0 0 1 * *" }, // First day of each month
  async ({
    step,
  }: {
    step: {
      run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
    };
  }) => {
    const users = await step.run("fetch-users", async () => {
      return (await db.user.findMany({
        include: { accounts: true },
      })) as User[];
    });

    for (const user of users) {
      await step.run(`generate-report-${user.id}`, async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const stats = await getMonthlyStats(user.id, lastMonth);
        const monthName = lastMonth.toLocaleString("default", {
          month: "long",
        });

        // Generate AI insights
        const insights = await generateFinancialInsights(stats, monthName);

        await sendEmail({
          to: user.email,
          subject: `Your Monthly Financial Report - ${monthName}`,
          react: EmailTemplate({
            userName: user.name || "User",
            type: "monthly-report" as const,
            data: {
              stats,
              month: monthName,
              insights,
            },
          }),
        });
      });
    }

    return { processed: users.length };
  }
);

export const checkBudgetAlert = inngest.createFunction(
  { id: "check-budget-alerts", name: "Check Budget Alerts" },
  { cron: "0 */6 * * *" }, // Fixed cron expression (every 6 hours)
  async ({
    step,
  }: {
    step: {
      run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
    };
  }) => {
    try {
      console.log("Starting budget alert check:", new Date().toISOString());

      const budgets = await step.run("fetch-budget", async () => {
        return (await db.budget.findMany({
          include: {
            user: {
              include: {
                accounts: {
                  where: {
                    isDefault: true,
                  },
                },
              },
            },
          },
        })) as Budget[];
      });

      console.log(`Found ${budgets.length} budgets to check`);

      for (const budget of budgets) {
        const defaultAccount = budget.user.accounts[0];
        if (!defaultAccount) {
          console.log(
            `Budget ${budget.id}: No default account found, skipping`
          );
          continue;
        }

        await step.run(`check-budget-${budget.id}`, async () => {
          try {
            // Get current month date range
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

            // Calculate expenses for the current month
            const expenses = await db.transaction.aggregate({
              where: {
                userId: budget.userId,
                accountId: defaultAccount.id,
                type: "EXPENSE",
                date: {
                  gte: startOfMonth,
                  lte: endOfMonth,
                },
              },
              _sum: {
                amount: true,
              },
            });

            const totalExpenses = expenses._sum.amount?.toNumber() || 0;
            const budgetAmount = budget.amount.toNumber();
            const percentageUsed = (totalExpenses / budgetAmount) * 100;

            console.log(
              `Budget ${budget.id}: ${percentageUsed.toFixed(2)}% used (${totalExpenses}/${budgetAmount})`
            );

            // Send alert if:
            // 1. Usage is >= 80% and no alert was sent before, OR
            // 2. It's a new month since the last alert
            if (
              (percentageUsed >= 80 && !budget.lastAlertSent) ||
              isNewMonth(budget.lastAlertSent, new Date())
            ) {
              console.log(
                `Budget ${budget.id}: Alert condition met, sending email to ${budget.user.email}`
              );

              try {
                // Fix: Create EmailTemplate props with correct types
                const emailProps = {
                  userName: budget.user.name ?? "User",
                  type: "budget-alert" as const, // Add 'as const' to ensure correct type
                  data: {
                    percentageUsed,
                    budgetAmount: parseFloat(budgetAmount.toFixed(1)),
                    totalExpenses: parseFloat(totalExpenses.toFixed(1)),
                    accountName: defaultAccount.name,
                  },
                };

                // Send the email with correctly typed props
                const emailResult = (await sendEmail({
                  to: budget.user.email,
                  subject: `Budget Alert for ${defaultAccount.name}`,
                  react: EmailTemplate(emailProps),
                })) as EmailResult;

                // Check result and update lastAlertSent only if successful
                if (emailResult.success) {
                  console.log(`Budget ${budget.id}: Email sent successfully`);

                  // Update lastAlertSent timestamp
                  await db.budget.update({
                    where: {
                      id: budget.id,
                    },
                    data: {
                      lastAlertSent: new Date(),
                    },
                  });

                  console.log(
                    `Budget ${budget.id}: lastAlertSent updated to ${new Date().toISOString()}`
                  );
                } else {
                  console.error(
                    `Budget ${budget.id}: Failed to send email:`,
                    emailResult.error
                  );
                }
              } catch (emailError) {
                console.error(
                  `Budget ${budget.id}: Error in email sending process:`,
                  emailError
                );
              }
            } else {
              console.log(`Budget ${budget.id}: No alert needed at this time`);
            }
          } catch (budgetError) {
            console.error(`Error processing budget ${budget.id}:`, budgetError);
          }
        });
      }

      console.log("Budget alert check completed");
      return { status: "completed" };
    } catch (error) {
      console.error("Fatal error in checkBudgetAlert function:", error);
      throw error; // Re-throw so Inngest knows there was an error
    }
  }
);

function isNewMonth(lastAlertDate: Date | null, currentDate: Date): boolean {
  return (
    lastAlertDate === null ||
    lastAlertDate.getFullYear() !== currentDate.getFullYear() ||
    lastAlertDate.getMonth() !== currentDate.getMonth()
  );
}

function isTransactionDue(transaction: {
  lastProcessed: Date | null | undefined;
  nextRecurringDate: Date;
}): boolean {
  // If no lastProcessed date, transaction is due
  if (!transaction.lastProcessed) return true;

  const today = new Date();
  const nextDue = new Date(transaction.nextRecurringDate);

  // Compare with nextDue date
  return nextDue <= today;
}

function calculateNextRecurringDate(
  date: Date,
  interval: RecurringInterval
): Date {
  const next = new Date(date);
  switch (interval) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      throw new Error(`Unsupported interval: ${interval}`);
  }
  return next;
}

async function getMonthlyStats(
  userId: string,
  month: Date
): Promise<MonthlyStats> {
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const transactions = (await db.transaction.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  })) as Transaction[];

  return transactions.reduce(
    (stats, t) => {
      const amount = t.amount.toNumber();
      if (t.type === "EXPENSE") {
        stats.totalExpenses += amount;
        stats.byCategory[t.category] =
          (stats.byCategory[t.category] || 0) + amount;
      } else {
        stats.totalIncome += amount;
      }
      return stats;
    },
    {
      totalExpenses: 0,
      totalIncome: 0,
      byCategory: {} as Record<string, number>,
      transactionCount: transactions.length,
    }
  );
}
