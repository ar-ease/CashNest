import Link from "next/link";
import React from "react";
import { Button } from "./ui/button";
import Image from "next/image";

const HeroSection = () => {
  return (
    <div className="pb-28 px-4">
      <div className="container mx-auto text-center">
        <h1 className="text-5xl md:text-8xl lg:text-[105px] pb-6 gradient-title">
          Manage Your Finances <br />
          with intelligence
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          An AI-powered financial management platform that helps you track
          analyze , and optimize your spending with real-time insights
        </p>
        <div className="flex justify-center space-x-4">
          <Link href="/dashboard">
            {" "}
            <Button size={"lg"}>Get started</Button>
          </Link>
          <Link href="/dashboard">
            {" "}
            <Button variant="outline" size={"lg"}>
              Get started
            </Button>
          </Link>
        </div>
        <div>
          <div>
            <Image
              src={"/banner.jpeg"}
              alt="dashboard preview"
              width={1280}
              height={720}
              className="rounded-lg shadow-2xl border mx-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
