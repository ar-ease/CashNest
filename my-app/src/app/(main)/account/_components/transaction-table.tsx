"use client";
import React from "react";
import { Clock, MoreHorizontal, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { categoryColors } from "@/data/categories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
type TransactionsType = {
  id: string;
  type: "EXPENSE" | "INCOME"; // or whatever your enum is
  amount: number;
  description: string;
  date: string | Date;
  category: string;
  receiptUrl?: string | null;
  isRecurring: boolean;
  recurringInterval?: string | null;
  nextReccurenceDate?: string | null;
  lastProcessed?: string | null;
  status?: string;
  userId: string;
  accountId: string;
  createdAt: string | Date;
};

const TransactionTable = ({
  transactions,
}: {
  transactions: TransactionsType[];
}) => {
  console.log("transaction", transactions);
  const filteredAndSortedTransactions = transactions;
  const handleSort = () => {};

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox />
              </TableHead>
              <TableHead
                className="cursor-pointer"
                // onClick={() => handleSort("date")}
              >
                <div className="flex items-center">Date</div>
              </TableHead>
              <TableHead>Description</TableHead>
              <TableHead
                className="cursor-pointer"
                // onClick={() => handleSort("category")}
              >
                <div className="flex items-center"> Category</div>
              </TableHead>
              <TableHead
                className="cursor-pointer"
                // onClick={() => handleSort("amount")}
              >
                <div className="flex items-center justify-end">Amount</div>
              </TableHead>
              <TableHead>Recurring</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedTransactions?.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedTransactions?.map((transaction: any) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {" "}
                    <Checkbox />
                  </TableCell>
                  <TableCell>
                    {format(new Date(transaction.date), "PP")}
                  </TableCell>

                  <TableCell>{transaction.description}</TableCell>
                  <TableCell className="capitalize">
                    <span
                      style={{
                        background: categoryColors[transaction.category],
                      }}
                      className="text-xs text-white px-2 py-1 rounded-md"
                    >
                      {transaction.category}
                    </span>
                  </TableCell>
                  <TableCell
                    className="text-right"
                    style={{
                      color: transaction.type === "EXPENSE" ? "red" : "green",
                    }}
                  >
                    {transaction.type === "EXPENSE" && (
                      <span className="text-red-500"></span>
                    )}
                    {transaction.type === "EXPENSE" && "-"}$
                    {transaction.type === "INCOME" && "+"}
                    {transaction.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    {transaction.isRecurring ? (
                      <TooltipProvider>
                        <Tooltip>
                          {" "}
                          <TooltipTrigger>
                            <Badge
                              variant="outline"
                              className="gap-1 bg-purple-100 text-purple-700 hover:bg-purple-200 pt-1 pb-1"
                            >
                              {" "}
                              <RefreshCcw className="h-3 w-3" />
                              {transaction.recurringInterval}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div>
                              <div>Next date : </div>
                              <div>
                                {format(new Date(transaction.date), "PP")}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        {" "}
                        <Clock className="h-3 w-3" />
                        One-time
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant={"ghost"} size="icon">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Profile</DropdownMenuItem>
                        <DropdownMenuItem>Billing</DropdownMenuItem>
                        <DropdownMenuItem>Team</DropdownMenuItem>
                        <DropdownMenuItem>Subscription</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TransactionTable;
