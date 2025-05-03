import { getUserAccount } from "@/actions/dashboard";
import { defaultCategories } from "@/data/categories";
import { AddTransactionForm } from "../_components/transaction-form";
import { getTransaction } from "@/actions/transaction";

export default async function AddTransactionPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  console.log("search params data", searchParams);

  const accounts = await getUserAccount();

  // Access as a property with better type checking
  const editId =
    typeof searchParams.edit === "string" ? searchParams.edit : null;
  console.log("this is the edit id", editId);

  let initialData = null;
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
            accounts={accounts}
            categories={defaultCategories.map((category) => ({
              ...category,
              type: category.type as "EXPENSE" | "INCOME",
            }))}
            editMode={false}
            initialData={null}
          />
        </div>
      ) : (
        <AddTransactionForm
          accounts={accounts}
          categories={defaultCategories.map((category) => ({
            ...category,
            type: category.type as "EXPENSE" | "INCOME",
          }))}
          editMode={!!initialData}
          initialData={initialData}
        />
      )}
    </div>
  );
}
