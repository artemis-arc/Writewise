"use client";

import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/features/auth/useAuth";

function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function ProfilePage() {
  const { user, status } = useAuth();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar />

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 overflow-y-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-brand">Your Profile</h1>

        {status === "loading" && <p className="text-sm text-foreground/60">Loading...</p>}

        {user && (
          <Card className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-lg font-semibold text-brand-foreground">
                {initials(user.displayName, user.email)}
              </span>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {user.displayName || "Unnamed User"}
                </p>
                <p className="text-sm text-foreground/60">{user.email}</p>
              </div>
            </div>

            <dl className="flex flex-col gap-3 border-t border-border-subtle pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground/50">Email</dt>
                <dd className="font-medium text-foreground">{user.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground/50">Display name</dt>
                <dd className="font-medium text-foreground">{user.displayName || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground/50">Member since</dt>
                <dd className="font-medium text-foreground">
                  {new Date(user.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </dd>
              </div>
            </dl>
          </Card>
        )}
      </div>
    </div>
  );
}
