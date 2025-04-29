import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { sendEmail } from "@/actions/send-email";
import EmailTemplate from "../../../emails/template";

export const checkBudgetAlert = inngest.createFunction(
  { id: "check-budget-alerts", name: "Check Budget Alerts" },
  { cron: "0 */6 * * *" }, // Fixed cron expression (every 6 hours)
  async ({ event, step }) => {
    try {
      console.log("Starting budget alert check:", new Date().toISOString());

      const budgets = await step.run("fetch-budget", async () => {
        return await db.budget.findMany({
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
        });
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
            const budgetAmount = Number(budget.amount);
            const percentageUsed = (totalExpenses / budgetAmount) * 100;

            console.log(
              `Budget ${budget.id}: ${percentageUsed.toFixed(2)}% used (${totalExpenses}/${budgetAmount})`
            );

            // Send alert if:
            // 1. Usage is >= 80% and no alert was sent before, OR
            // 2. It's a new month since the last alert
            if (
              (percentageUsed >= 80 && !budget.lastAlertSent) ||
              isNewMonth(
                budget.lastAlertSent ? new Date(budget.lastAlertSent) : null,
                new Date()
              )
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
                    budgetAmount: parseFloat(Number(budgetAmount).toFixed(1)),
                    totalExpenses: parseFloat(Number(totalExpenses).toFixed(1)),
                    accountName: defaultAccount.name,
                  },
                };

                // Send the email with correctly typed props
                const emailResult = await sendEmail({
                  to: budget.user.email,
                  subject: `Budget Alert for ${defaultAccount.name}`,
                  react: EmailTemplate(emailProps),
                });

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
    } catch (error) {
      console.error("Fatal error in checkBudgetAlert function:", error);
      throw error; // Re-throw so Inngest knows there was an error
    }
  }
);

/**
 * Checks if the current date is in a different month than the last alert date
 */
function isNewMonth(lastAlertDate: Date | null, currentDate: Date): boolean {
  return (
    lastAlertDate === null ||
    lastAlertDate.getFullYear() !== currentDate.getFullYear() ||
    lastAlertDate.getMonth() !== currentDate.getMonth()
  );
}
