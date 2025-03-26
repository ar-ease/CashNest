import { Decimal } from "@prisma/client/runtime/library";

export interface Account {
  id: string;
  name: string;
  type: "current" | "savings"; // Ensure these match
  balance: number; // If using Prisma.Decimal, convert to number
  isDefault: boolean;
}
