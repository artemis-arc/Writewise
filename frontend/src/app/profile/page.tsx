"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { buttonClassNames } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScoreHistoryChart } from "@/components/history/ScoreHistoryChart";
import { SubmissionList } from "@/components/history/SubmissionList";
import { useAuth } from "@/features/auth/useAuth";
import type { ScoreHistoryEntry, SubmissionSummary } from "@/features/history/types";

type LoadStatus = "loading" | "success" | "error";

function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [scores, setScores] = useState<ScoreHistoryEntry[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/history/scores").then((res) => (res.ok ? res.json() : Promise.reject())),
      fetch("/api/history/submissions").then((res) => (res.ok ? res.json() : Promise.reject())),
    ])
      .then(([scoreData, submissionData]) => {
        if (cancelled) return;
        setScores(scoreData);
        setSubmissions(submissionData);
        setStatus("success");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TopBar />

      <div className="flex w-full flex-1 flex-col gap-8 overflow-y-auto px-8 py-8 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-brand">
              Welcome{user?.displayName ? `, ${user.displayName}` : ""}.
            </h1>
            <p className="text-sm text-foreground/60">
              Your account, writing progress, and past submissions, all in one place.
            </p>
          </div>
          <Link href="/task-definition" className={buttonClassNames("primary")}>
            Start a New Task
          </Link>
        </div>

        {user && (
          <Card className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-brand-foreground">
                {initials(user.displayName, user.email)}
              </span>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {user.displayName || "Unnamed User"}
                </p>
                <p className="text-sm text-foreground/60">{user.email}</p>
              </div>
            </div>

            <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm sm:border-l sm:border-border-subtle sm:pl-6">
              <div>
                <dt className="text-xs uppercase tracking-wide text-foreground/50">Member since</dt>
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

        {status === "loading" && <p className="text-sm text-foreground/60">Loading your history...</p>}
        {status === "error" && (
          <p className="text-sm font-medium text-red-500">
            Could not load your history. Please try refreshing the page.
          </p>
        )}

        {status === "success" && (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <Card className="flex flex-col gap-4">
              <h2 className="font-semibold text-foreground">Score Progress</h2>
              <ScoreHistoryChart scores={scores} />
            </Card>

            <div className="flex flex-col gap-4">
              <h2 className="font-semibold text-foreground">Past Writings</h2>
              <SubmissionList submissions={submissions} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
