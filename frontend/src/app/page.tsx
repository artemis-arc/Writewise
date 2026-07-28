import Image from "next/image";
import Link from "next/link";
import { Button, buttonClassNames } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/icons";

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center overflow-y-auto">
      {/* <Image src="/logo.png" alt="Write Wise" width={96} height={96} priority className="h-24 w-24" /> */}

      <div className="flex flex-col gap-3">
        <p className="max-w-md text-balance text-foreground/70">
          Elevate your manuscript with AI-powered{" "}
          <span className="font-semibold text-brand">academic writing analysis.</span>{" "}
          Precise, scholarly, and rigorous.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/task-definition" className={buttonClassNames("primary")}>
          Get Started
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
        <Button variant="secondary" type="button">
          Learn More
        </Button>
      </div>
    </main>
  );
}
