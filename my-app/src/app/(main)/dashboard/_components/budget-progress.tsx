"use client";
import React, { useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useFetch from "@/hooks/use-fetch";
import { updateBudget } from "@/actions/budget";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface BudgetProgressProps {
  initialBudget: {
    id: string;
    amount: number;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    lastAlertSent: Date | null;
  } | null;
  currentExpenses: number;
}

const BudgetProgress: React.FC<BudgetProgressProps> = ({
  initialBudget,
  currentExpenses,
}) => {
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [newBudget, setNewBudget] = React.useState<string>(
    initialBudget?.amount?.toString() || "" // Handle null safely
  );
  //   const [currentBudget, setCurrentBudget] = React.useState(initialBudget); // Track the current budget locally

  const percentageUsed = initialBudget
    ? (currentExpenses / initialBudget.amount) * 100
    : 0;

  const {
    loading: isLoading,
    fn: updateBudgetFn,
    data: updatedBudget,
    error,
  } = useFetch(updateBudget);

  const handleUpdateBudget = async () => {
    const amount = parseFloat(newBudget);

    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    await updateBudgetFn(amount);
  };

  useEffect(() => {
    if (updatedBudget?.success) {
      setIsEditing(false);
      toast.success("Budget updated successfully");
    }
  }, [updatedBudget]);

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to update budget");
    }
  }, [error]);

  const handleCancel = () => {
    setIsEditing(false);
    setNewBudget(initialBudget?.amount?.toString() || ""); // Reset to the current budget value
  };

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex-1">
            <CardTitle>Monthly budget (Default Account)</CardTitle>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <div>
                  <Input
                    type="number"
                    value={newBudget}
                    onChange={(e) => setNewBudget(e.target.value)}
                    className="w-32"
                    placeholder="Enter amount"
                    autoFocus
                    disabled={isLoading}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleUpdateBudget}
                    disabled={isLoading}
                  >
                    <Check className="h-4 w-4 text-green-500" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleCancel}>
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ) : (
                <>
                  <CardDescription>
                    {initialBudget
                      ? `$${currentExpenses.toFixed(
                          2
                        )} of $${initialBudget?.amount?.toFixed(2)} spent`
                      : "No Budget set"}
                  </CardDescription>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-4 w-4 text-blue-500" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            <Progress
              value={percentageUsed}
              extraStyles={`${
                percentageUsed >= 90
                  ? "bg-red-500"
                  : percentageUsed >= 75
                  ? "bg-yellow-500 "
                  : "bg-purple-500"
              }`}
            />
            <p className="text-xs text-muted-foreground text-right pt-2">
              {percentageUsed.toFixed(1)}% of budget used
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetProgress;
