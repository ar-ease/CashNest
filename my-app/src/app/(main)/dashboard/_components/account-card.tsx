"use client";
import React, { useEffect } from "react";
import { Account } from "@/types/account";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import useFetch from "@/hooks/use-fetch";
import { updateDefaultAccount } from "@/actions/accounts";
import { toast } from "sonner";

const AccountCard: React.FC<{ account: Account }> = ({ account }) => {
  const { name, type, balance, id, isDefault } = account;
  const {
    loading: updateDefaultLoading,
    fn: updateDefaultFn,
    data: updatedAccount,
    error,
  } = useFetch(updateDefaultAccount);

  const handleDefaultChange = async () => {
    if (isDefault) {
      toast.warning("You need at least one default account");
      return;
    }

    await updateDefaultFn(id);
  };

  useEffect(() => {
    if (updatedAccount?.success) {
      toast.success("Account updated successfully");
    }
  }, [updatedAccount]);

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to update default account");
    }
  }, [error]);

  // Prevent the Link from capturing the Switch click
  const handleSwitchClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Link href={`/account/${id}`} className="flex-grow">
          <CardTitle>{name}</CardTitle>
        </Link>
        <div onClick={handleSwitchClick}>
          <Switch
            checked={isDefault}
            onCheckedChange={handleDefaultChange}
            disabled={updateDefaultLoading || isDefault}
          />
        </div>
      </CardHeader>
      <Link href={`/account/${id}`}>
        <CardContent>
          <div className="text-2xl font-bold">
            ${typeof balance === "number" ? balance.toFixed(2) : "0.00"}
          </div>
          <p className="text-xs text-muted-foreground capitalize">
            {type.charAt(0) + type.slice(1).toLowerCase()}
          </p>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="flex items-center">
            <ArrowUpRight className="mr-1 h-4 w-4 text-green-500" />
          </div>
          <div className="flex items-center">
            <ArrowUpRight className="mr-1 h-4 w-4 text-red-500" />
          </div>
        </CardFooter>
      </Link>
    </Card>
  );
};

export default AccountCard;
