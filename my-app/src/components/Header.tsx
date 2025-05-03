import {
  SignedIn,
  SignedOut,
  UserButton,
  SignInButton,
  SignUpButton,
} from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Button } from "./ui/button";
import { LayoutDashboard, PenBox } from "lucide-react";
import { checkUser } from "@/lib/checkuser";

export const Header = async () => {
  await checkUser();
  return (
    <>
      <div className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Image src={"/logo.png"} alt="logo" width={100} height={60} />
          </Link>
          <div className="flex items-center space-x-4">
            <SignedIn>
              <Link
                href={"/dashboard"}
                className=" text-gray-600 hover:text-blue-600 flex items-center gap-2"
              >
                <Button variant={"outline"}>
                  <LayoutDashboard size={18} />
                  dashboard
                </Button>
              </Link>
              <Link href={"/transaction/create"} className="">
                <Button>
                  <PenBox size={18} />
                  transactions
                </Button>
              </Link>
            </SignedIn>
            <SignedOut>
              <SignInButton forceRedirectUrl={"/dashboard"}>
                <Button variant={"outline"}>Login</Button>
              </SignInButton>
              {/* <SignUpButton /> */}
            </SignedOut>
            <SignedIn>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10",
                  },
                }}
              />
            </SignedIn>
          </div>
        </nav>
      </div>
    </>
  );
};
