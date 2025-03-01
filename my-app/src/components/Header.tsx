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
import { LayoutDashboard } from "lucide-react";

export const Header = () => {
  return (
    <>
      <div className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Image src={"/logo.png"} alt="logo" width={100} height={100} />
          </Link>
          <div>
            <SignedIn>
              <Link href="/dashboard">
                <Button variant={"outline"}>
                  <LayoutDashboard />
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
              <UserButton />
            </SignedIn>
          </div>
        </nav>
      </div>
    </>
  );
};
