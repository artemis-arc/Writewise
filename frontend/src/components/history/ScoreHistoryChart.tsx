"use client";

import { useId, useMemo, useState } from "react";
import type { ScoreHistoryEntry } from "@/features/history/types";

interface ScoreHistoryChartProps {
  scores: ScoreHistoryEntry[];
}

type SeriesKey = "mechanics" | "organization" | "overall";

const SERIES: { key: SeriesKey; label: string }[] = [
  { key: "mechanics", label: "Mechanics" },
  { key: "organization", label: "Organization" },
  { key: "overall", label: "Overall" },
];

const CHART_WIDTH = 640;
const CHART_HEIGHT = 260;
const PADDING = { top: 16, right: 16, bottom: 32, left: 36 };

export function ScoreHistoryChart({ scores }: ScoreHistoryChartProps) {
  const titleId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const chronological = useMemo(() => [...scores].reverse(), [scores]);

  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const points = useMemo(() => {
    const count = chronological.length;
    return SERIES.map((series) => ({
      ...series,
      values: chronological.map((entry, index) => {
        const x = count <= 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth;
        const y = plotHeight - (entry[series.key] / 100) * plotHeight;
        return { x, y, value: entry[series.key] };
      }),
    }));
  }, [chronological, plotWidth, plotHeight]);

  if (scores.length === 0) {
    return (
      <p className="text-sm text-foreground/60">
        No scored writing yet -- upload a manuscript to see your progress here.
      </p>
    );
  }

  const gridLines = [0, 25, 50, 75, 100];
  const hovered = hoverIndex !== null ? chronological[hoverIndex] : null;

  return (
    <div className="viz-root flex flex-col gap-4">
      <style>{`
        .viz-root {
          color-scheme: light;
          --surface-1: var(--surface);
          --text-secondary: color-mix(in srgb, var(--foreground) 60%, transparent);
          --gridline: var(--border-subtle);
          --series-mechanics: #2a78d6;
          --series-organization: #eb6834;
          --series-overall: #1baf7a;
        }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .viz-root {
            color-scheme: dark;
            --series-mechanics: #3987e5;
            --series-organization: #d95926;
            --series-overall: #199e70;
          }
        }
        :root[data-theme="dark"] .viz-root {
          color-scheme: dark;
          --series-mechanics: #3987e5;
          --series-organization: #d95926;
          --series-overall: #199e70;
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-4" aria-label="Score categories">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-2 text-xs text-foreground/70">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: `var(--series-${series.key})` }}
                aria-hidden="true"
              />
              {series.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          className="text-xs font-semibold text-brand hover:underline"
        >
          {showTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-foreground/50">
                <th className="py-2 pr-4">Date</th>
                {SERIES.map((series) => (
                  <th key={series.key} className="py-2 pr-4">
                    {series.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chronological.map((entry) => (
                <tr key={entry.id} className="border-t border-border-subtle">
                  <td className="py-2 pr-4 text-foreground/70">
                    {new Date(entry.scoredAt).toLocaleDateString()}
                  </td>
                  {SERIES.map((series) => (
                    <td key={series.key} className="py-2 pr-4 tabular-nums">
                      {entry[series.key].toFixed(0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg
          role="img"
          aria-labelledby={titleId}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <title id={titleId}>Writing scores over time, by category</title>
          <g transform={`translate(${PADDING.left}, ${PADDING.top})`}>
            {gridLines.map((line) => {
              const y = plotHeight - (line / 100) * plotHeight;
              return (
                <g key={line}>
                  <line
                    x1={0}
                    x2={plotWidth}
                    y1={y}
                    y2={y}
                    stroke="var(--gridline)"
                    strokeWidth={1}
                  />
                  <text x={-8} y={y} textAnchor="end" dominantBaseline="middle" className="fill-foreground/40 text-[10px]">
                    {line}
                  </text>
                </g>
              );
            })}

            {points.map((series) => (
              <polyline
                key={series.key}
                points={series.values.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={`var(--series-${series.key})`}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {points.map((series) =>
              series.values.map((p, index) => (
                <circle
                  key={`${series.key}-${index}`}
                  cx={p.x}
                  cy={p.y}
                  r={hoverIndex === index ? 4 : 3}
                  fill={`var(--series-${series.key})`}
                  stroke="var(--surface-1)"
                  strokeWidth={1}
                />
              )),
            )}

            {chronological.map((_, index) => {
              const count = chronological.length;
              const x = count <= 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth;
              return (
                <rect
                  key={index}
                  x={x - plotWidth / Math.max(count, 1) / 2}
                  y={0}
                  width={plotWidth / Math.max(count, 1)}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(index)}
                />
              );
            })}

            {hoverIndex !== null && (
              <line
                x1={points[0].values[hoverIndex].x}
                x2={points[0].values[hoverIndex].x}
                y1={0}
                y2={plotHeight}
                stroke="var(--gridline)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}
          </g>
        </svg>
      )}

      {hovered && (
        <div className="rounded-xl border border-border-subtle bg-surface-muted p-3 text-xs">
          <p className="font-semibold text-foreground/80">
            {new Date(hovered.scoredAt).toLocaleString()}
          </p>
          <div className="mt-1 grid grid-cols-3 gap-x-4 gap-y-1">
            {SERIES.map((series) => (
              <span key={series.key} className="text-foreground/60">
                {series.label}: <span className="font-semibold text-foreground">{hovered[series.key].toFixed(0)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
