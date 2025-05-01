import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

// Define types for our data
type CategoryExpenses = {
  [category: string]: number;
};

type MonthlyReportStats = {
  totalIncome: number;
  totalExpenses: number;
  byCategory?: CategoryExpenses;
};

type MonthlyReportData = {
  month: string;
  stats: MonthlyReportStats;
  insights?: string[];
};

type BudgetAlertData = {
  percentageUsed: number;
  budgetAmount: number;
  totalExpenses: number;
};

type EmailProps = {
  userName?: string;
  type?: "monthly-report" | "budget-alert";
  data?: any;
};

// Default data to use when no data is provided
const DEFAULT_DATA = {
  "monthly-report": {
    month: "Current Month",
    stats: {
      totalIncome: 5000,
      totalExpenses: 3500,
      byCategory: {
        housing: 1500,
        groceries: 600,
        transportation: 400,
        entertainment: 300,
        utilities: 700,
      },
    },
    insights: [
      "This is a sample insight about your spending.",
      "This is another sample insight about your finances.",
      "This is a third sample insight with recommendations.",
    ],
  },
  "budget-alert": {
    percentageUsed: 85,
    budgetAmount: 4000,
    totalExpenses: 3400,
  },
};

function isMonthlyReportData(data: any): data is MonthlyReportData {
  return (
    data &&
    "month" in data &&
    "stats" in data &&
    "totalIncome" in data.stats &&
    "totalExpenses" in data.stats
  );
}

function isBudgetAlertData(data: any): data is BudgetAlertData {
  return (
    data &&
    "percentageUsed" in data &&
    "budgetAmount" in data &&
    "totalExpenses" in data
  );
}

export default function EmailTemplate({
  userName = "User",
  type = "monthly-report",
  data = {},
}: EmailProps) {
  console.log("EmailTemplate called with:", { userName, type, data });

  // Check if data is empty and use default data if needed
  const isEmpty = Object.keys(data).length === 0;

  // Use default data if empty
  const effectiveData = isEmpty
    ? DEFAULT_DATA[type as keyof typeof DEFAULT_DATA]
    : data;

  console.log("Using data:", effectiveData);

  // Monthly Report Template
  if (type === "monthly-report") {
    return (
      <Html>
        <Head />
        <Preview>Your Monthly Financial Report</Preview>
        <Body style={styles.body}>
          <Container style={styles.container}>
            <Heading style={styles.title}>Monthly Financial Report</Heading>

            <Text style={styles.text}>Hello {userName},</Text>
            <Text style={styles.text}>
              Here&rsquo;s your financial summary for {effectiveData.month}:
            </Text>

            {/* Main Stats */}
            <Section style={styles.statsContainer}>
              <div style={styles.stat}>
                <Text style={styles.text}>Total Income</Text>
                <Text style={styles.heading}>
                  ${effectiveData.stats.totalIncome}
                </Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.text}>Total Expenses</Text>
                <Text style={styles.heading}>
                  ${effectiveData.stats.totalExpenses}
                </Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.text}>Net</Text>
                <Text style={styles.heading}>
                  $
                  {effectiveData.stats.totalIncome -
                    effectiveData.stats.totalExpenses}
                </Text>
              </div>
            </Section>

            {/* Category Breakdown */}
            {effectiveData.stats.byCategory && (
              <Section style={styles.section}>
                <Heading style={styles.heading}>Expenses by Category</Heading>
                {Object.entries(effectiveData.stats.byCategory).map(
                  ([category, amount]) => (
                    <div key={category} style={styles.row}>
                      <Text style={styles.text}>{category}</Text>
                      <Text style={styles.text}>${amount}</Text>
                    </div>
                  )
                )}
              </Section>
            )}

            {/* AI Insights */}
            {effectiveData.insights && (
              <Section style={styles.section}>
                <Heading style={styles.heading}>Welth Insights</Heading>
                {effectiveData.insights.map(
                  (insight: string, index: number) => (
                    <Text key={index} style={styles.text}>
                      • {insight}
                    </Text>
                  )
                )}
              </Section>
            )}

            <Text style={styles.footer}>
              Thank you for using Welth. Keep tracking your finances for better
              financial health!
            </Text>
          </Container>
        </Body>
      </Html>
    );
  }

  // Budget Alert Template
  if (type === "budget-alert") {
    return (
      <Html>
        <Head />
        <Preview>Budget Alert</Preview>
        <Body style={styles.body}>
          <Container style={styles.container}>
            <Heading style={styles.title}>Budget Alert</Heading>
            <Text style={styles.text}>Hello {userName},</Text>
            <Text style={styles.text}>
              You&rsquo;ve used {effectiveData.percentageUsed.toFixed(1)}% of
              your monthly budget.
            </Text>
            <Section style={styles.statsContainer}>
              <div style={styles.stat}>
                <Text style={styles.text}>Budget Amount</Text>
                <Text style={styles.heading}>
                  ${effectiveData.budgetAmount}
                </Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.text}>Spent So Far</Text>
                <Text style={styles.heading}>
                  ${effectiveData.totalExpenses}
                </Text>
              </div>
              <div style={styles.stat}>
                <Text style={styles.text}>Remaining</Text>
                <Text style={styles.heading}>
                  ${effectiveData.budgetAmount - effectiveData.totalExpenses}
                </Text>
              </div>
            </Section>
          </Container>
        </Body>
      </Html>
    );
  }

  // Default fallback - should never reach here with our default type
  return (
    <Html>
      <Head />
      <Preview>Email Template</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.title}>Email Template</Heading>
          <Text style={styles.text}>Hello {userName},</Text>
          <Text style={styles.text}>
            Invalid email type provided: {type}. Please contact support.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Define the CSS styles with TypeScript interface
interface StylesDictionary {
  [key: string]: React.CSSProperties;
}

const styles: StylesDictionary = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily: "-apple-system, sans-serif",
  },
  container: {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    padding: "20px",
    borderRadius: "5px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  },
  title: {
    color: "#1f2937",
    fontSize: "32px",
    fontWeight: "bold",
    textAlign: "center",
    margin: "0 0 20px",
  },
  heading: {
    color: "#1f2937",
    fontSize: "20px",
    fontWeight: "600",
    margin: "0 0 16px",
  },
  text: {
    color: "#4b5563",
    fontSize: "16px",
    margin: "0 0 16px",
  },
  section: {
    marginTop: "32px",
    padding: "20px",
    backgroundColor: "#f9fafb",
    borderRadius: "5px",
    border: "1px solid #e5e7eb",
  },
  statsContainer: {
    margin: "32px 0",
    padding: "20px",
    backgroundColor: "#f9fafb",
    borderRadius: "5px",
  },
  stat: {
    marginBottom: "16px",
    padding: "12px",
    backgroundColor: "#fff",
    borderRadius: "4px",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 0",
    borderBottom: "1px solid #e5e7eb",
  },
  footer: {
    color: "#6b7280",
    fontSize: "14px",
    textAlign: "center",
    marginTop: "32px",
    paddingTop: "16px",
    borderTop: "1px solid #e5e7eb",
  },
};
