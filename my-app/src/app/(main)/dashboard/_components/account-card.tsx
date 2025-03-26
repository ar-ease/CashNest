import React from "react";
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

const AccountCard: React.FC<{ account: Account }> = ({ account }) => {
  const { name, type, balance, id, isDefault } = account;

  return (
    <Link href={`/account/${id}`}>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{name}</CardTitle>
          <Switch
            checked={isDefault}
            // Add onChange handler if needed
          />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            $
            {typeof balance === "number"
              ? balance.toFixed(2)
              : parseFloat(balance).toFixed(2)}
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
      </Card>
    </Link>
  );
};

export default AccountCard;
