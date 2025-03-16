import { Button } from "@/components/ui/button";
import Link from "next/link";
import React from "react";

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className=" ">
        <h1 className="text-2xl font-semibold">
          OOPS...This page is not Found{" "}
        </h1>

        <div className="flex  justify-center items-center pt-5">
          <Link href={"/"}>
            {" "}
            <Button size={"lg"}>Return Home</Button>{" "}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
