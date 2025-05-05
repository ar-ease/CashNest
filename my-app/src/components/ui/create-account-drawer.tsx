"use client";
import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { accountSchema } from "@/app/lib/schema"; // Import from your schema file
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";
import useFetch from "@/hooks/use-fetch";
import { createAccount } from "@/actions/dashboard";
import { Loader2 } from "lucide-react";

const CreateAccountDrawer = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: "CURRENT",
      balance: "",
      isDefault: false,
    },
  });

  const { fn: createAccountFn, isLoading: createAccountLoading } =
    useFetch(createAccount);

  const onSubmit = async (formData: z.infer<typeof accountSchema>) => {
    try {
      await createAccountFn(formData);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to create account:", error);
    }
  };

  return (
    <div>
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Create New Account</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 ">
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Account Name
                </label>
                <Input id="name" {...register("name")} />
                {errors?.name && (
                  <p className="text-red-500">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="type" className="text-sm font-medium">
                  Account type
                </label>
                <Select
                  onValueChange={(value) =>
                    setValue("type", value as "CURRENT" | "SAVINGS")
                  }
                  defaultValue={watch("type")}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CURRENT">Current</SelectItem>
                    <SelectItem value="SAVINGS">Savings</SelectItem>
                  </SelectContent>
                </Select>
                {errors?.type && (
                  <p className="text-red-500">{errors.type.message}</p>
                )}
              </div>
              <div className="space-y-2 ">
                <label htmlFor="balance" className="text-sm font-medium">
                  Initial Balance
                </label>
                <Input
                  id="balance"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("balance")}
                />
                {errors?.balance && (
                  <p className="text-red-500">{errors.balance.message}</p>
                )}
              </div>
              <div className="space-y-2 items-center justify-between rounded-lg border p-4 flex">
                <div className="space-y-0.5">
                  <label
                    htmlFor="isDefault"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Set as Default
                  </label>
                  <p className="text-sm text-muted-foreground">
                    This account will be selected for transactions
                  </p>
                </div>
                <div>
                  <Switch
                    id="isDefault"
                    onCheckedChange={(checked) =>
                      setValue("isDefault", checked)
                    }
                    checked={watch("isDefault")}
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <DrawerClose asChild>
                  <Button type="button" variant="outline" className="flex-1">
                    Cancel
                  </Button>
                </DrawerClose>
                <Button
                  type="submit"
                  className="flex-1 ml-2"
                  disabled={createAccountLoading}
                >
                  {createAccountLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                      Creating...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default CreateAccountDrawer;
