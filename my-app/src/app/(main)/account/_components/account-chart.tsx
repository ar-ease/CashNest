"use client";
import { endOfDay, startOfDay, subDays } from "date-fns";
import React, { PureComponent, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Rectangle,
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
  type: "EXPENSE" | "INCOME"; // or whatever your enum is
  amount: number;
  description: string;
  date: string | Date;
  category: string;
  receiptUrl?: string | null;
  isRecurring: boolean;
};
const AccountChart = ({
  transactions,
}: {
  transactions: TransactionsType[];
}) => {
  //   console.log("hell", transactions);
  const [dateRange, setDateRange] =
    React.useState<keyof typeof DATE_RANGES>("1M");
  const now = new Date();
  const filteredData = useMemo(() => {
    const range = DATE_RANGES[dateRange];
    const startDate = range.days
      ? startOfDay(subDays(now, range.days))
      : startOfDay(new Date(0));
    const filtered = transactions?.filter((t: any) => {
      const transactionDate = new Date(t.date);
      return transactionDate >= startDate && transactionDate <= endOfDay(now);
    });

    const grouped = filtered?.reduce((acc: any, t: any) => {
      const date = new Date(t.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!acc[date]) {
        acc[date] = { date, income: 0, expense: 0 };
      }
      acc[date].income += t.amount;
      acc[date].expense += t.amount; // Assuming uv is also the amount
      return acc;
    }, {});
    return Object?.values(grouped).sort(
      (a: any, b: any) =>
        new Date(a.name).getTime() - new Date(b.name).getTime()
    );
  }, [transactions, dateRange]);
  const totals = useMemo<{
    income: number;
    expense: number;
  }>(() => {
    return (
      filteredData?.reduce(
        (acc: { income: number; expense: number }, t: any) => {
          acc.income += t.income;
          acc.expense += t.expense;
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
            value={dateRange} // Bind the current value to the state
            onValueChange={(value) =>
              setDateRange(value as keyof typeof DATE_RANGES)
            } // Update the state on change
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
