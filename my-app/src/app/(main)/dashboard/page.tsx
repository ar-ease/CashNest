import { Account } from "@/types/account";
import { Card, CardContent } from "@/components/ui/card";
import CreateAccountDrawer from "@/components/create-account-drawer";
import { Plus } from "lucide-react";
import { getUserAccount } from "@/actions/dashboard";
import AccountCard from "./_components/account-card";
import { getCurrentBudget } from "@/actions/budget";
import BudgetProgress from "./_components/budget-progress";

const DashboardPage = async () => {
  const accounts: Account[] = await getUserAccount();
  const accountsArray = Object.values(accounts);
  const defaultAccount = accountsArray.find((account) => account.isDefault);
  let budgetData = null;
  if (defaultAccount) {
    budgetData = await getCurrentBudget(defaultAccount.id);
  }
  return (
    <div className=" space-y-8">
      {defaultAccount && (
        <BudgetProgress
          initialBudget={budgetData?.budget || null}
          currentExpenses={budgetData?.currentExpenses || 0}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CreateAccountDrawer>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-muted-foreground h-full pt-5">
              <Plus className="h-10 w-10 mb-2" />
              <p className="text-sm font-medium">Add New Account</p>
            </CardContent>
          </Card>
        </CreateAccountDrawer>

        {accountsArray?.length > 0 ? (
          accountsArray.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))
        ) : (
          <p className="text-gray-500">No accounts found.</p>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
