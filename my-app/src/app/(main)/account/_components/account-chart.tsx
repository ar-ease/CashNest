"use client";
import { endOfDay, startOfDay, subDays } from "date-fns";
import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const DATE_RANGES = {
  "7D": { label: "7 Days", days: 7 },
  "1M": { label: "30 Days", days: 30 },
  "3M": { label: "3 Months", days: 90 },
  "6M": { label: "6 Months", days: 180 },
  "1Y": { label: "1 Year", days: 365 },
  ALL: { label: "All", days: null },
};

type TransactionsType = {
  id: string;
  type: "EXPENSE" | "INCOME";
  amount: number;
  description: string;
  date: string | Date;
  category: string;
  receiptUrl?: string | null;
  isRecurring: boolean;
};

// Define types for grouped data and chart data
interface GroupedData {
  date: string;
  income: number;
  expense: number;
}

interface TransactionTotals {
  income: number;
  expense: number;
}

const AccountChart = ({
  transactions,
}: {
  transactions: TransactionsType[];
}) => {
  const [dateRange, setDateRange] =
    React.useState<keyof typeof DATE_RANGES>("1M");

  const filteredData = useMemo(() => {
    const now = new Date();
    const range = DATE_RANGES[dateRange];
    const startDate = range.days
      ? startOfDay(subDays(now, range.days))
      : startOfDay(new Date(0));

    const filtered = transactions?.filter((transaction: TransactionsType) => {
      const transactionDate = new Date(transaction.date);
      return transactionDate >= startDate && transactionDate <= endOfDay(now);
    });

    const grouped = filtered?.reduce(
      (acc: Record<string, GroupedData>, transaction: TransactionsType) => {
        const date = new Date(transaction.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

        if (!acc[date]) {
          acc[date] = { date, income: 0, expense: 0 };
        }

        if (transaction.type === "INCOME") {
          acc[date].income += transaction.amount;
        } else if (transaction.type === "EXPENSE") {
          acc[date].expense += transaction.amount;
        }

        return acc;
      },
      {}
    );

    return Object.values(grouped || {}).sort(
      (a: GroupedData, b: GroupedData) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [transactions, dateRange]);

  const totals = useMemo<TransactionTotals>(() => {
    return (
      filteredData?.reduce(
        (acc: TransactionTotals, data: GroupedData) => {
          acc.income += data.income;
          acc.expense += data.expense;
          return acc;
        },
        { income: 0, expense: 0 }
      ) || { income: 0, expense: 0 }
    );
  }, [filteredData]);

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <CardTitle>Transaction Overview</CardTitle>
          <Select
            value={dateRange}
            onValueChange={(value) =>
              setDateRange(value as keyof typeof DATE_RANGES)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Duration" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DATE_RANGES).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="flex justify-around mb-6 text-sm">
            <div className="text-center">
              <p className="text-muted-foreground">Total Income</p>
              <p className="text-lg font-bold text-green-500">
                ${totals.income.toFixed(2)}
              </p>
              <div className="text-center">
                <p className="text-muted-foreground">Total Expense</p>
                <p className="text-lg font-bold text-red-500">
                  ${totals.expense.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Total Income</p>
              <p
                className={`text-lg font-bold ${
                  totals.income - totals.expense >= 0
                    ? "text-green-500"
                    : "text-red-500"
                } `}
              >
                ${(totals.income - totals.expense).toFixed(2)}
              </p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredData}
                margin={{
                  top: 10,
                  right: 10,
                  left: 10,
                  bottom: 0,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip formatter={(value) => [`$${value}`, undefined]} />
                <Legend />
                <Bar
                  dataKey="income"
                  fill="#8884d8"
                  name="Income"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expense"
                  fill="#82ca9d"
                  name="Expense"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountChart;
