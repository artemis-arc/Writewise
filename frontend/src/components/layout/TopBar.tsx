import Image from "next/image";
import Link from "next/link";
import { ProfileMenu } from "@/components/layout/ProfileMenu";

export function TopBar() {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface px-6 py-3">
      <Link href="/" className="flex items-center">
        <Image src="/logo-horizontal.png" alt="Write Wise" width={98} height={36} priority className="h-9 w-auto" />
      </Link>
      <ProfileMenu />
    </header>
  );
}
