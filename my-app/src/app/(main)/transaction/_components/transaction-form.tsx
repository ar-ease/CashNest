"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import useFetch from "@/hooks/use-fetch";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import CreateAccountDrawer from "@/components/create-account-drawer";
import { cn } from "@/lib/utils";
import { createTransaction, updateTransaction } from "@/actions/transaction";
import { transactionSchema } from "@/app/lib/schema";
import { ReceiptScanner } from "./recipt-scanner";

// Define types for our props and data structures
type TransactionType = "EXPENSE" | "INCOME";
type RecurringInterval = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

interface Account {
  id: string;
  name: string;
  balance: string;
  isDefault?: boolean;
}

interface Category {
  id: string;
  name: string;
  type: TransactionType;
}

interface TransactionData {
  type: TransactionType;
  amount: number;
  description: string;
  accountId: string;
  category: string;
  date: string | Date;
  isRecurring: boolean;
  recurringInterval?: RecurringInterval;
}

interface FormData {
  type: TransactionType;
  amount: string;
  description?: string;
  accountId: string;
  category: string;
  date: Date;
  isRecurring: boolean;
  recurringInterval?: RecurringInterval;
}

interface ScannedData {
  amount: number;
  date: string | Date;
  description?: string;
  category?: string;
}

interface AddTransactionFormProps {
  accounts: Account[];
  categories: Category[];
  editMode?: boolean;
  initialData?: TransactionData | null;
}

export function AddTransactionForm({
  accounts,
  categories,
  editMode = false,
  initialData = null,
}: AddTransactionFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues:
      editMode && initialData
        ? {
            type: initialData.type,
            amount: initialData.amount.toString(),
            description: initialData.description,
            accountId: initialData.accountId,
            category: initialData.category,
            date: new Date(initialData.date),
            isRecurring: initialData.isRecurring,
            ...(initialData.recurringInterval && {
              recurringInterval: initialData.recurringInterval,
            }),
          }
        : {
            type: "EXPENSE" as TransactionType,
            amount: "",
            description: "",
            accountId: accounts.find((ac) => ac.isDefault)?.id,
            date: new Date(),
            isRecurring: false,
          },
  });

  // Memoize the transaction function to avoid recreating it on every render
  const transactionAction = useCallback(
    (data: TransactionData) => {
      if (editMode && editId) {
        return updateTransaction(editId, {
          ...data,
          date: new Date(data.date),
        });
      }
      return createTransaction({
        ...data,
        date: new Date(data.date),
      });
    },
    [editMode, editId]
  );
  const {
    loading: transactionLoading,
    fn: transactionFn,
    data: transactionResult,
  } = useFetch<
    { success: boolean; data: { accountId: string } },
    [TransactionData]
  >(transactionAction);

  // Memoize the submit handler
  const onSubmit = useCallback(
    (data: FormData) => {
      if (isSubmitting) return;

      setIsSubmitting(true);
      const formData: TransactionData = {
        ...data,
        description: data.description || "",
        amount: parseFloat(data.amount),
      };

      transactionFn(formData).finally(() => {
        setIsSubmitting(false);
      });
    },
    [transactionFn, isSubmitting]
  );

  // Memoize the scan completion handler
  const handleScanComplete = useCallback(
    (scannedData: ScannedData | null) => {
      if (scannedData) {
        setValue("amount", scannedData.amount.toString());
        setValue("date", new Date(scannedData.date));
        if (scannedData.description) {
          setValue("description", scannedData.description);
        }
        if (scannedData.category) {
          setValue("category", scannedData.category);
        }
        toast.success("Receipt scanned successfully");
      }
    },
    [setValue]
  );

  // Use stable reference for navigation
  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  useEffect(() => {
    if (transactionResult?.success && !transactionLoading) {
      toast.success(
        editMode
          ? "Transaction updated successfully"
          : "Transaction created successfully"
      );
      reset();

      // Navigate after a short delay
      const timeoutId = setTimeout(() => {
        router.push(`/account/${transactionResult.data.accountId}`);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [transactionResult, transactionLoading, editMode, reset, router]);

  // State values from form
  const type = watch("type") as TransactionType;
  const isRecurring = watch("isRecurring");
  const date = watch("date");

  // Memoize handlers for Select interactions
  const handleTypeChange = useCallback(
    (value: string) => {
      setValue("type", value as TransactionType);
    },
    [setValue]
  );

  const handleAccountChange = useCallback(
    (value: string) => {
      setValue("accountId", value);
    },
    [setValue]
  );

  const handleCategoryChange = useCallback(
    (value: string) => {
      setValue("category", value);
    },
    [setValue]
  );

  const handleRecurringChange = useCallback(
    (checked: boolean) => {
      setValue("isRecurring", checked);
    },
    [setValue]
  );

  const handleIntervalChange = useCallback(
    (value: string) => {
      setValue("recurringInterval", value as RecurringInterval);
    },
    [setValue]
  );

  const handleDateSelect = useCallback(
    (date?: Date) => {
      if (date) setValue("date", date);
    },
    [setValue]
  );

  // Memoize the filtered categories to avoid recalculation on every render
  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === type),
    [categories, type]
  );

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Receipt Scanner - Only show in create mode */}
        {!editMode && <ReceiptScanner onScanComplete={handleScanComplete} />}

        {/* Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <Select value={type} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EXPENSE">Expense</SelectItem>
              <SelectItem value="INCOME">Income</SelectItem>
            </SelectContent>
          </Select>
          {errors.type && (
            <p className="text-sm text-red-500">
              {errors.type.message as string}
            </p>
          )}
        </div>

        {/* Amount and Account */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount</label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("amount")}
            />
            {errors.amount && (
              <p className="text-sm text-red-500">
                {errors.amount.message as string}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Account</label>
            <Select
              value={getValues("accountId")}
              onValueChange={handleAccountChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} (${parseFloat(account.balance).toFixed(2)})
                  </SelectItem>
                ))}
                <CreateAccountDrawer>
                  <Button
                    type="button"
                    variant="ghost"
                    className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  >
                    Create Account
                  </Button>
                </CreateAccountDrawer>
              </SelectContent>
            </Select>
            {errors.accountId && (
              <p className="text-sm text-red-500">
                {errors.accountId.message as string}
              </p>
            )}
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <Select
            value={getValues("category")}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-sm text-red-500">
              {errors.category.message as string}
            </p>
          )}
        </div>

        {/* Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "w-full pl-3 text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                {date ? format(date, "PPP") : <span>Pick a date</span>}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                disabled={(date) =>
                  date > new Date() || date < new Date("1900-01-01")
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.date && (
            <p className="text-sm text-red-500">
              {errors.date.message as string}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <Input placeholder="Enter description" {...register("description")} />
          {errors.description && (
            <p className="text-sm text-red-500">
              {errors.description.message as string}
            </p>
          )}
        </div>

        {/* Recurring Toggle */}
        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <label className="text-base font-medium">
              Recurring Transaction
            </label>
            <div className="text-sm text-muted-foreground">
              Set up a recurring schedule for this transaction
            </div>
          </div>
          <Switch
            checked={isRecurring}
            onCheckedChange={handleRecurringChange}
          />
        </div>

        {/* Recurring Interval */}
        {isRecurring && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Recurring Interval</label>
            <Select
              value={getValues("recurringInterval")}
              onValueChange={handleIntervalChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="YEARLY">Yearly</SelectItem>
              </SelectContent>
            </Select>
            {errors.recurringInterval && (
              <p className="text-sm text-red-500">
                {errors.recurringInterval.message as string}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="w-full"
            disabled={transactionLoading || isSubmitting}
          >
            {transactionLoading || isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {editMode ? "Updating..." : "Creating..."}
              </>
            ) : editMode ? (
              "Update Transaction"
            ) : (
              "Create Transaction"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
