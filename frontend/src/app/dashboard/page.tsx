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

export default function DashboardPage() {
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
              Your writing progress and past submissions, all in one place.
            </p>
          </div>
          <Link href="/task-definition" className={buttonClassNames("primary")}>
            Start a New Task
          </Link>
        </div>

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
