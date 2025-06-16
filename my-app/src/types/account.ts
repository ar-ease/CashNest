export interface Account {
  id: string;
  name: string;
  type: "CURRENT" | "SAVINGS";
  balance: number;
  isDefault: boolean;
  userId: string;
  createdAt: string;
  _count?: {
    transactions: number;
  };
}
export type AccountType = "CURRENT" | "SAVINGS";
