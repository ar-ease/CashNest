import AccountCard from "@/app/(main)/account/_components/account-chart";
import { getAccountWithTransactions } from "@/actions/accounts";
import { notFound } from "next/navigation";
import React, { Suspense } from "react";
import TransactionTable from "../_components/transaction-table";
import BarLoader from "react-spinners/BarLoader";
import { PageProps } from "@/types/pageProps";

// Import the PageProps type from Next.js generated types

const AccountPage = async ({ params }: PageProps) => {
  // Await the params Promise to get the id
  const { id } = await params;

  if (!id) {
    return notFound();
  }

  const accountData = await getAccountWithTransactions(id);
  // console.log(accountData);

  if (!accountData) {
    return notFound();
  }

  const { transactions, ...account } = accountData;
  // console.log(transactions);
  const { type, balance } = account;

  return (
    <div className="space-y-8 px-5 ">
      <div className="flex gap-4 items-end justify-between">
        <div>
          {" "}
          <h1 className="text-5xl sm:text-6xl font-bold gradient-title capitalize">
            {account.name}
          </h1>
          <p className="text-muted-foreground">
            {" "}
            {type.charAt(0) + type.slice(1).toLowerCase()} Account
          </p>
        </div>
        <div className="text-right pb-2">
          <div className="text-xl sm:text-2xl font-bold">
            {" "}
            ${balance.toFixed(2)}
          </div>
          <p className="text-sm text-muted-foreground">
            {account._count.transactions}
          </p>
        </div>
      </div>
      {/* chart table */}
      <Suspense
        fallback={<BarLoader className="mt-4" width={"100%"} color="#9333ea" />}
      >
        <AccountCard
          transactions={transactions.map((transaction) => ({
            ...transaction,
            type: transaction.type.toUpperCase() as "EXPENSE" | "INCOME",
            amount: parseFloat(transaction.amount.toString()),
          }))}
        />
      </Suspense>
      {/*transactions table*/}
      <Suspense
        fallback={<BarLoader className="mt-4" width={"100%"} color="#9333ea" />}
      >
        <TransactionTable
          transactions={transactions.map((transaction) => ({
            ...transaction,
            type: transaction.type.toUpperCase() as "EXPENSE" | "INCOME",
            amount: parseFloat(transaction.amount.toString()),
          }))}
        />
      </Suspense>
    </div>
  );
};

export default AccountPage;
