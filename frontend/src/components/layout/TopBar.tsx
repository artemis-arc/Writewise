"use client";

import Image from "next/image";
import Link from "next/link";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { useAuth } from "@/features/auth/useAuth";

export function TopBar() {
  const { user } = useAuth();

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center">
          <Image src="/logo-horizontal.png" alt="Write Wise" width={160} height={40} priority className="h-9 w-auto" />
        </Link>
        {user && (
          <Link
            href="/dashboard"
            className="text-sm font-medium text-foreground/70 hover:text-brand"
          >
            Dashboard
          </Link>
        )}
      </div>
      <ProfileMenu />
    </header>
  );
}
