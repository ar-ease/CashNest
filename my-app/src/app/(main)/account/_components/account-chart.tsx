"use client";
import { endOfDay, startOfDay, subDays } from "date-fns";
import React, { PureComponent, useMemo } from "react";
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
        acc[date] = { name: date, income: 0, expense: 0 };
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
  console.log("testsssssssssssssss");
  console.log(filteredData);
  const totals = useMemo(() => {
    return filteredData?.reduce(
      (acc: any, t: any) => {
        acc.income += t.income;
        acc.expense += t.expense;
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [filteredData]);

  return (
    <div>
      {/* <ResponsiveContainer width="100%" height="100%">
        <BarChart
          width={500}
          height={300}
          data={filteredData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar
            dataKey="pv"
            fill="#8884d8"
            activeBar={<Rectangle fill="pink" stroke="blue" />}
          />
          <Bar
            dataKey="uv"
            fill="#82ca9d"
            activeBar={<Rectangle fill="gold" stroke="purple" />}
          />
        </BarChart>
      </ResponsiveContainer> */}
    </div>
  );
};

export default AccountChart;
