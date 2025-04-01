import { getAccountWithTransactions } from "@/actions/accounts";
import { notFound } from "next/navigation";
import React from "react";
interface AccountPageProps {
  params: { id: string };
}
const AccountPage = async ({ params }: AccountPageProps) => {
  const accountData = await getAccountWithTransactions(params.id);

  console.log(accountData);
  if (!accountData) {
    return notFound();
  }
  return (
    <>
      <div>AccountPage</div>
      <div> {params.id}</div>
    </>
  );
};

export default AccountPage;
