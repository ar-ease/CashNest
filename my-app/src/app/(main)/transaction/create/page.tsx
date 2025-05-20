import { getUserAccount } from "@/actions/dashboard";
import { defaultCategories } from "@/data/categories";
import { AddTransactionForm } from "../_components/transaction-form";
import { getTransaction } from "@/actions/transaction";
import { PageProps } from "@/types/pageProps";
// Define the page props to match Next.js 15's expected structure

export default async function AddTransactionPage({ searchParams }: PageProps) {
  // Await the searchParams Promise to get the actual parameters
  const searchParamsData = await searchParams;
  console.log("search params data", searchParamsData);

  // Fetch user accounts first
  const accounts = await getUserAccount();

  // Extract needed properties from searchParams
  const editParam = searchParamsData.edit;
  // Then type check the extracted values
  const editId = typeof editParam === "string" ? editParam : null;
  console.log("this is the edit id", editId);

  // Initialize transaction data
  let initialData = null;

  // Only fetch transaction details if we have a valid editId
  if (editId) {
    try {
      console.log("Attempting to fetch transaction with ID:", editId);
      const transaction = await getTransaction(editId);
      console.log("Transaction returned:", transaction);
      if (transaction) {
        initialData = {
          ...transaction,
          recurringInterval: transaction.recurringInterval ?? undefined,
          amount: Number(transaction.amount), // Convert Decimal to number
        };
        console.log("Initial data prepared:", initialData);
      } else {
        console.log("No transaction found with ID:", editId);
      }
    } catch (error) {
      console.error("Error fetching transaction:", error);
    }
  }

  // Format accounts for the form
  const formattedAccounts = accounts.map((account) => ({
    ...account,
    balance: account.balance.toString(),
  }));

  // Format categories for the form
  const formattedCategories = defaultCategories.map((category) => ({
    ...category,
    type: category.type as "EXPENSE" | "INCOME",
  }));

  return (
    <div className="max-w-3xl mx-auto px-5">
      <div className="flex justify-center md:justify-normal mb-8">
        <h1 className="text-5xl gradient-title ">
          {initialData ? "Edit" : "Add"} Transaction
        </h1>
      </div>
      {editId && !initialData ? (
        <div>
          <p className="text-red-500 mb-4">
            Transaction not found. Please try again or add a new transaction.
          </p>
          <AddTransactionForm
            accounts={formattedAccounts}
            categories={formattedCategories}
            editMode={false}
            initialData={null}
          />
        </div>
      ) : (
        <AddTransactionForm
          accounts={formattedAccounts}
          categories={formattedCategories}
          editMode={!!initialData}
          initialData={initialData}
        />
      )}
    </div>
  );
}
