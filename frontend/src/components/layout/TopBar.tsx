import Image from "next/image";
import Link from "next/link";

export function TopBar() {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-surface px-6 py-3">
      <Link href="/" className="flex items-center">
        <Image src="/logo-horizontal.png" alt="Write Wise" width={160} height={40} priority className="h-9 w-auto" />
      </Link>
      <div
        aria-hidden="true"
        className="h-9 w-9 rounded-full bg-surface-muted"
      />
    </header>
  );
}
