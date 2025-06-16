import { Account } from "@/types/accountType";
import { Decimal } from "@prisma/client/runtime/library";

// Match the Prisma enum exactly
export type TransactionType = "INCOME" | "EXPENSE";
export type RecurringInterval = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type TransactionStatus = "COMPLETED" | "PENDING" | "CANCELLED";
export type AccountType = "CURRENT" | "SAVINGS";

export interface Transaction {
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
  // Optional relations
  account?: Account;
  user?: User;
}

export interface User {
  id: string;
  clerkUserId: string;
  email: string;
  name?: string | null;
  imageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Optional relations
  accounts?: Account[];
  transactions?: Transaction[];
  budgets?: Budget[];
}

export interface Budget {
  id: string;
  userId: string;
  amount: Decimal;
  lastAlertSent?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Optional relations
  user?: User;
}

export interface EventData {
  transactionId: string;
  userId: string;
}

export interface MonthlyStats {
  totalExpenses: number;
  totalIncome: number;
  byCategory: Record<string, number>;
  transactionCount: number;
}
