import { db } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { inngest } from "./client";
import { sendEmail } from "@/actions/send-email";
import EmailTemplate from "../../../emails/template";
import { Decimal } from "@prisma/client/runtime/library";

// Use custom types
import {
  TransactionType,
  RecurringInterval,
  TransactionStatus,
  EventData,
  MonthlyStats,
} from "@/types/transactionType";
import { AccountType } from "@/types/accountType";

// Database transaction client type
type DatabaseTransaction = Parameters<Parameters<typeof db.$transaction>[0]>[0];

// Prisma types for database operations (with Decimal)
type PrismaTransaction = {
  id: string;
  type: TransactionType;
  amount: Decimal;
  description: string;
  date: Date;
  category: string;
  receiptUrl?: string | null;
  isRecurring: boolean;
  recurringInterval?: RecurringInterval | null;
  nextRecurringDate?: Date | null;
  lastProcessed?: Date | null;
  status: TransactionStatus;
  userId: string;
  accountId: string;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaAccount = {
  id: string;
  name: string;
  type: AccountType;
  balance: Decimal;
  isDefault: boolean;
  userId: string;
  createdAt: Date;
};

type PrismaUser = {
  id: string;
  clerkUserId: string;
  email: string;
  name?: string | null;
  imageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaBudget = {
  id: string;
  userId: string;
  amount: Decimal;
  lastAlertSent?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// Extended types for database operations
type PrismaTransactionWithAccount = PrismaTransaction & {
  account: PrismaAccount;
};

type PrismaUserWithAccounts = PrismaUser & {
  accounts: PrismaAccount[];
};

type PrismaBudgetWithUser = PrismaBudget & {
  user: PrismaUserWithAccounts;
};

// Email result interface
interface EmailResult {
  success: boolean;
  error?: string;
}

// Inngest event types
interface InngestEvent<T = unknown> {
  data: T;
  name?: string;
  ts?: number;
}

interface InngestStep {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  sleep?: (name: string, duration: string) => Promise<void>;
}

interface InngestContext<T = unknown> {
  event: InngestEvent<T>;
  step: InngestStep;
}

// Function result types
interface ProcessTransactionResult {
  status: "processed" | "skipped";
  reason?: string;
  transactionId?: string;
  error?: string;
}

interface TriggerRecurringResult {
  triggered: number;
}

interface MonthlyReportResult {
  processed: number;
}

interface BudgetAlertResult {
  status: "completed";
}

// Transaction creation data
interface RecurringTransactionCreateData {
  type: TransactionType;
  amount: Decimal;
  description: string;
  date: Date;
  category: string;
  isRecurring: boolean;
  status: TransactionStatus;
  userId: string;
  accountId: string;
}

// Transaction update data
interface TransactionUpdateData {
  lastProcessed: Date;
  nextRecurringDate: Date;
}

// Account balance update data
interface AccountBalanceUpdate {
  balance: {
    increment: number;
  };
}

// Budget update data
interface BudgetUpdateData {
  lastAlertSent: Date;
}

// Email template props
interface EmailTemplateProps {
  userName: string;
  type: "budget-alert" | "monthly-report";
  data: BudgetAlertData | MonthlyReportData;
}

interface BudgetAlertData {
  percentageUsed: number;
  budgetAmount: number;
  totalExpenses: number;
  accountName: string;
}

interface MonthlyReportData {
  stats: MonthlyStats;
  month: string;
  insights: string[];
}

// Aggregate result type
interface TransactionAggregateResult {
  _sum: {
    amount: Decimal | null;
  };
}

// Helper functions to convert between Prisma and custom types

// Process recurring transaction function
export const processRecurringTransaction = inngest.createFunction(
  {
    id: "process-recurring-transaction",
    name: "Process Recurring Transaction",
    throttle: {
      limit: 10,
      period: "1m",
      key: "event.data.userId",
    },
  },
  { event: "transaction.recurring.process" },
  async ({
    event,
    step,
  }: InngestContext<EventData>): Promise<ProcessTransactionResult> => {
    // Validate event data
    if (!event?.data?.transactionId || !event?.data?.userId) {
      console.error("Invalid event data:", event);
      return { status: "skipped", error: "Missing required event data" };
    }

    return await step.run(
      "process-transaction",
      async (): Promise<ProcessTransactionResult> => {
        const prismaTransaction = (await db.transaction.findUnique({
          where: {
            id: event.data.transactionId,
            userId: event.data.userId,
          },
          include: {
            account: true,
          },
        })) as PrismaTransactionWithAccount | null;

        if (
          !prismaTransaction ||
          !prismaTransaction.nextRecurringDate ||
          !isTransactionDue({
            lastProcessed: prismaTransaction.lastProcessed,
            nextRecurringDate: prismaTransaction.nextRecurringDate,
          })
        ) {
          return {
            status: "skipped",
            reason: "Transaction not due or not found",
          };
        }

        // Create new transaction and update account balance
        await db.$transaction(async (tx: DatabaseTransaction) => {
          // Create new transaction
          const transactionCreateData: RecurringTransactionCreateData = {
            type: prismaTransaction.type,
            amount: prismaTransaction.amount,
            description: `${prismaTransaction.description} (Recurring)`,
            date: new Date(),
            category: prismaTransaction.category,
            isRecurring: false,
            status: "COMPLETED",
            userId: prismaTransaction.userId,
            accountId: prismaTransaction.accountId,
          };

          await tx.transaction.create({
            data: transactionCreateData,
          });

          // Update account balance
          const balanceChange: number =
            prismaTransaction.type === "EXPENSE"
              ? -prismaTransaction.amount.toNumber()
              : prismaTransaction.amount.toNumber();

          const balanceUpdateData: AccountBalanceUpdate = {
            balance: { increment: balanceChange },
          };

          await tx.account.update({
            where: { id: prismaTransaction.accountId },
            data: balanceUpdateData,
          });

          // Update last processed date and next recurring date
          const updateData: TransactionUpdateData = {
            lastProcessed: new Date(),
            nextRecurringDate: calculateNextRecurringDate(
              new Date(),
              prismaTransaction.recurringInterval as RecurringInterval
            ),
          };

          await tx.transaction.update({
            where: { id: prismaTransaction.id },
            data: updateData,
          });
        });

        return { status: "processed", transactionId: prismaTransaction.id };
      }
    );
  }
);

// Trigger recurring transactions with batching
export const triggerRecurringTransactions = inngest.createFunction(
  {
    id: "trigger-recurring-transactions",
    name: "Trigger Recurring Transactions",
  },
  { cron: "0 0 * * *" },
  async ({ step }: { step: InngestStep }): Promise<TriggerRecurringResult> => {
    const recurringTransactions = await step.run(
      "fetch-recurring-transactions",
      async (): Promise<PrismaTransaction[]> => {
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
        })) as PrismaTransaction[];
      }
    );

    // Send event for each recurring transaction in batches
    if (recurringTransactions.length > 0) {
      const events = recurringTransactions.map(
        (transaction: PrismaTransaction) => ({
          name: "transaction.recurring.process",
          data: {
            transactionId: transaction.id,
            userId: transaction.userId,
          },
        })
      );

      // Send events directly using inngest.send()
      await inngest.send(events);
    }

    return { triggered: recurringTransactions.length };
  }
);

// Generate financial insights using AI
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
      .map(([category, amount]: [string, number]) => `${category}: $${amount}`)
      .join(", ")}

    Format the response as a JSON array of strings, like this:
    ["insight 1", "insight 2", "insight 3"]
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    return JSON.parse(cleanedText) as string[];
  } catch (error) {
    console.error("Error generating insights:", error);
    return [
      "Your highest expense category this month might need attention.",
      "Consider setting up a budget for better financial management.",
      "Track your recurring expenses to identify potential savings.",
    ];
  }
}

// Monthly report generation
export const generateMonthlyReports = inngest.createFunction(
  {
    id: "generate-monthly-reports",
    name: "Generate Monthly Reports",
  },
  { cron: "0 0 1 * *" },
  async ({ step }: { step: InngestStep }): Promise<MonthlyReportResult> => {
    const prismaUsers = await step.run(
      "fetch-users",
      async (): Promise<PrismaUserWithAccounts[]> => {
        return (await db.user.findMany({
          include: { accounts: true },
        })) as PrismaUserWithAccounts[];
      }
    );

    for (const prismaUser of prismaUsers) {
      await step.run(
        `generate-report-${prismaUser.id}`,
        async (): Promise<void> => {
          const lastMonth = new Date();
          lastMonth.setMonth(lastMonth.getMonth() - 1);

          const stats: MonthlyStats = await getMonthlyStats(
            prismaUser.id,
            lastMonth
          );
          const monthName: string = lastMonth.toLocaleString("default", {
            month: "long",
          });

          // Generate AI insights
          const insights: string[] = await generateFinancialInsights(
            stats,
            monthName
          );

          const emailData: MonthlyReportData = {
            stats,
            month: monthName,
            insights,
          };

          const emailProps: EmailTemplateProps = {
            userName: prismaUser.name || "User",
            type: "monthly-report",
            data: emailData,
          };

          await sendEmail({
            to: prismaUser.email,
            subject: `Your Monthly Financial Report - ${monthName}`,
            react: EmailTemplate(emailProps),
          });
        }
      );
    }

    return { processed: prismaUsers.length };
  }
);

// Budget alert checking
export const checkBudgetAlert = inngest.createFunction(
  { id: "check-budget-alerts", name: "Check Budget Alerts" },
  { cron: "0 */6 * * *" },
  async ({ step }: { step: InngestStep }): Promise<BudgetAlertResult> => {
    try {
      console.log("Starting budget alert check:", new Date().toISOString());

      const prismaBudgets = await step.run(
        "fetch-budget",
        async (): Promise<PrismaBudgetWithUser[]> => {
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
          })) as PrismaBudgetWithUser[];
        }
      );

      console.log(`Found ${prismaBudgets.length} budgets to check`);

      for (const prismaBudget of prismaBudgets) {
        const defaultAccount: PrismaAccount | undefined =
          prismaBudget.user.accounts[0];
        if (!defaultAccount) {
          console.log(
            `Budget ${prismaBudget.id}: No default account found, skipping`
          );
          continue;
        }

        await step.run(
          `check-budget-${prismaBudget.id}`,
          async (): Promise<void> => {
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
              const expenses = (await db.transaction.aggregate({
                where: {
                  userId: prismaBudget.userId,
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
              })) as TransactionAggregateResult;

              const totalExpenses: number =
                expenses._sum.amount?.toNumber() || 0;
              const budgetAmount: number = prismaBudget.amount.toNumber();
              const percentageUsed: number =
                (totalExpenses / budgetAmount) * 100;

              console.log(
                `Budget ${prismaBudget.id}: ${percentageUsed.toFixed(
                  2
                )}% used (${totalExpenses}/${budgetAmount})`
              );

              // Send alert if:
              // 1. Usage is >= 80% and no alert was sent before, OR
              // 2. It's a new month since the last alert
              if (
                (percentageUsed >= 80 && !prismaBudget.lastAlertSent) ||
                isNewMonth(prismaBudget.lastAlertSent, new Date())
              ) {
                console.log(
                  `Budget ${prismaBudget.id}: Alert condition met, sending email to ${prismaBudget.user.email}`
                );

                try {
                  // Create EmailTemplate props with correct types
                  const alertData: BudgetAlertData = {
                    percentageUsed,
                    budgetAmount: parseFloat(budgetAmount.toFixed(1)),
                    totalExpenses: parseFloat(totalExpenses.toFixed(1)),
                    accountName: defaultAccount.name,
                  };

                  const emailProps: EmailTemplateProps = {
                    userName: prismaBudget.user.name ?? "User",
                    type: "budget-alert",
                    data: alertData,
                  };

                  // Send the email with correctly typed props
                  const emailResult = (await sendEmail({
                    to: prismaBudget.user.email,
                    subject: `Budget Alert for ${defaultAccount.name}`,
                    react: EmailTemplate(emailProps),
                  })) as EmailResult;

                  // Check result and update lastAlertSent only if successful
                  if (emailResult.success) {
                    console.log(
                      `Budget ${prismaBudget.id}: Email sent successfully`
                    );

                    // Update lastAlertSent timestamp
                    const updateData: BudgetUpdateData = {
                      lastAlertSent: new Date(),
                    };

                    await db.budget.update({
                      where: {
                        id: prismaBudget.id,
                      },
                      data: updateData,
                    });

                    console.log(
                      `Budget ${
                        prismaBudget.id
                      }: lastAlertSent updated to ${new Date().toISOString()}`
                    );
                  } else {
                    console.error(
                      `Budget ${prismaBudget.id}: Failed to send email:`,
                      emailResult.error
                    );
                  }
                } catch (emailError) {
                  console.error(
                    `Budget ${prismaBudget.id}: Error in email sending process:`,
                    emailError
                  );
                }
              } else {
                console.log(
                  `Budget ${prismaBudget.id}: No alert needed at this time`
                );
              }
            } catch (budgetError) {
              console.error(
                `Error processing budget ${prismaBudget.id}:`,
                budgetError
              );
            }
          }
        );
      }

      console.log("Budget alert check completed");
      return { status: "completed" };
    } catch (error) {
      console.error("Fatal error in checkBudgetAlert function:", error);
      throw error;
    }
  }
);

// Helper functions
function isNewMonth(
  lastAlertDate: Date | null | undefined,
  currentDate: Date
): boolean {
  return (
    lastAlertDate === null ||
    lastAlertDate === undefined ||
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

  const prismaTransactions = (await db.transaction.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  })) as PrismaTransaction[];

  return prismaTransactions.reduce(
    (stats: MonthlyStats, t: PrismaTransaction) => {
      const amount: number = t.amount.toNumber();
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
      transactionCount: prismaTransactions.length,
    }
  );
}
