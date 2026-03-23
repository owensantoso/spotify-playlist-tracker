import type { ReactNode } from "react";
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { SectionCard } from "@/components/section-card";
import type {
  ContributorShareBucket,
  HistogramBucket,
  HeatmapDay,
  TimeSeriesPoint,
} from "@/lib/services/stats-service";
import { cn, formatLifetimeMs } from "@/lib/utils";

type HorizontalBarItem = {
  label: string;
  value: number;
  valueLabel: string;
  meta?: string;
};

type ChartShellProps = {
  title: string;
  eyebrow: string;
  description: string;
  className?: string;
  children: ReactNode;
};

const seriesColors = [
  "rgba(255, 191, 105, 0.9)",
  "rgba(106, 161, 109, 0.9)",
  "rgba(99, 179, 237, 0.9)",
  "rgba(234, 88, 12, 0.9)",
  "rgba(181, 212, 173, 0.9)",
];

function withAlpha(color: string, alpha: number) {
  return color.replace(/rgba\(([^)]+),\s*[\d.]+\)/, `rgba($1, ${alpha})`);
}

function ChartShell({ title, eyebrow, description, className, children }: ChartShellProps) {
  return (
    <SectionCard
      title={title}
      eyebrow={eyebrow}
      className={cn("h-full", className)}
    >
      <p className="max-w-2xl text-sm text-stone-400">{description}</p>
      <div className="mt-4">{children}</div>
    </SectionCard>
  );
}

function buildPolylinePath(points: Array<{ x: number; y: number }>) {
  if (!points.length) {
    return "";
  }

  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function buildAreaPath(
  upperPoints: Array<{ x: number; y: number }>,
  lowerPoints: Array<{ x: number; y: number }>,
) {
  if (!upperPoints.length) {
    return "";
  }

  const top = buildPolylinePath(upperPoints);
  const bottom = [...lowerPoints].reverse()
    .map((point) => `L ${point.x} ${point.y}`)
    .join(" ");

  return `${top} ${bottom} Z`;
}

function getHeatmapKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function pickTickIndices(length: number) {
  if (length <= 5) {
    return new Set(Array.from({ length }, (_, index) => index));
  }

  return new Set([
    0,
    Math.floor((length - 1) / 4),
    Math.floor((length - 1) / 2),
    Math.floor(((length - 1) * 3) / 4),
    length - 1,
  ]);
}

function LineChart({
  points,
  accent,
  labels,
}: {
  points: TimeSeriesPoint[];
  accent: string;
  labels?: string;
}) {
  if (!points.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/10 text-sm text-stone-400">
        No chart data yet.
      </div>
    );
  }

  const width = 1000;
  const height = 280;
  const padding = { top: 18, right: 18, bottom: 42, left: 16 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const xStep = points.length > 1 ? innerWidth / (points.length - 1) : 0;
  const tickIndices = pickTickIndices(points.length);

  const linePoints = points.map((point, index) => ({
    x: padding.left + (points.length === 1 ? innerWidth / 2 : index * xStep),
    y: padding.top + innerHeight - (point.value / maxValue) * innerHeight,
  }));
  const areaPath = buildAreaPath(
    linePoints,
    linePoints.map((point) => ({
      x: point.x,
      y: padding.top + innerHeight,
    })),
  );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-[1.4rem] border border-white/8 bg-black/10 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] min-w-full">
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = padding.top + innerHeight - (tick / 100) * innerHeight;
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="4 6"
                />
                <text x={4} y={y + 4} className="fill-stone-500 text-[10px]">
                  {tick}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill={withAlpha(accent, 0.16)} />
          <path
            d={buildPolylinePath(linePoints)}
            fill="none"
            stroke={accent}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {linePoints.map((point, index) => (
            <circle
              key={`${point.x}-${point.y}`}
              cx={point.x}
              cy={point.y}
              r={index === linePoints.length - 1 ? 5 : 3}
              fill={accent}
              stroke="rgba(8,17,13,0.9)"
              strokeWidth={2}
            />
          ))}

          {points.map((point, index) =>
            tickIndices.has(index) ? (
              <text
                key={`${point.label}-${index}`}
                x={linePoints[index].x}
                y={height - 12}
                textAnchor="middle"
                className="fill-stone-500 text-[10px]"
              >
                {point.label}
              </text>
            ) : null,
          )}
        </svg>
      </div>
      {labels ? <p className="text-xs uppercase tracking-[0.24em] text-stone-500">{labels}</p> : null}
    </div>
  );
}

function StackedAreaChart({ buckets }: { buckets: ContributorShareBucket[] }) {
  if (!buckets.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/10 text-sm text-stone-400">
        No contributor share data yet.
      </div>
    );
  }

  const width = 1000;
  const height = 280;
  const padding = { top: 18, right: 16, bottom: 38, left: 16 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const xStep = buckets.length > 1 ? innerWidth / (buckets.length - 1) : 0;
  const tickIndices = pickTickIndices(buckets.length);
  const seriesLabels = buckets[0]?.series.map((series) => series.label) ?? [];

  const normalizedSeries = seriesLabels.map((label, seriesIndex) =>
    buckets.map((bucket, bucketIndex) => {
      const total = bucket.total || 1;
      const cumulativeBefore = bucket.series.slice(0, seriesIndex).reduce((sum, series) => sum + series.value, 0);
      const currentValue = bucket.series[seriesIndex]?.value ?? 0;
      const lower = total === 0 ? 0 : (cumulativeBefore / total) * 100;
      const upper = total === 0 ? 0 : ((cumulativeBefore + currentValue) / total) * 100;
      const x = padding.left + (buckets.length === 1 ? innerWidth / 2 : bucketIndex * xStep);
      const yUpper = padding.top + innerHeight - (upper / 100) * innerHeight;
      const yLower = padding.top + innerHeight - (lower / 100) * innerHeight;

      return {
        x,
        yUpper,
        yLower,
      };
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {seriesLabels.map((label, index) => (
          <span
            key={label}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-stone-300"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: seriesColors[index % seriesColors.length] }}
            />
            {label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto rounded-[1.4rem] border border-white/8 bg-black/10 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] min-w-full">
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = padding.top + innerHeight - (tick / 100) * innerHeight;
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="4 6"
                />
                <text x={4} y={y + 4} className="fill-stone-500 text-[10px]">
                  {tick}
                </text>
              </g>
            );
          })}

          {normalizedSeries.map((seriesPoints, seriesIndex) => {
            const upper = seriesPoints.map((point) => ({
              x: point.x,
              y: point.yUpper,
            }));
            const lower = seriesPoints.map((point) => ({
              x: point.x,
              y: point.yLower,
            }));

            return (
              <path
                key={seriesLabels[seriesIndex]}
                d={buildAreaPath(upper, lower)}
                fill={withAlpha(seriesColors[seriesIndex % seriesColors.length], 0.18)}
                stroke={seriesColors[seriesIndex % seriesColors.length]}
                strokeWidth={1.4}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {buckets.map((bucket, index) =>
            tickIndices.has(index) ? (
              <text
                key={`${bucket.label}-${index}`}
                x={padding.left + (buckets.length === 1 ? innerWidth / 2 : index * xStep)}
                y={height - 12}
                textAnchor="middle"
                className="fill-stone-500 text-[10px]"
              >
                {bucket.label}
              </text>
            ) : null,
          )}
        </svg>
      </div>
      <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
        Share of additions by week. Higher bands mean a contributor took a larger share of the new songs in that period.
      </p>
    </div>
  );
}

function HeatmapChart({ days }: { days: HeatmapDay[] }) {
  if (!days.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/10 text-sm text-stone-400">
        No heatmap data yet.
      </div>
    );
  }

  const daysByKey = new Map(days.map((day) => [getHeatmapKey(day.date), day.value] as const));
  const firstDate = days[0].date;
  const lastDate = days[days.length - 1].date;
  const months = eachMonthOfInterval({
    start: startOfMonth(firstDate),
    end: startOfMonth(lastDate),
  });
  const max = Math.max(...days.map((day) => day.value), 1);
  const intensitySwatches = [0.05, 0.18, 0.36, 0.62, 0.88];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-stone-500">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-black/10 px-3 py-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[rgba(255,191,105,0.2)]" />
            Low activity
          </span>
          <div className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-black/10 px-3 py-1">
            {intensitySwatches.map((opacity, index) => (
              <span
                key={`${opacity}-${index}`}
                className="h-2.5 w-2.5 rounded-[0.25rem] border border-white/10"
                style={{ backgroundColor: `rgba(255, 191, 105, ${opacity})` }}
              />
            ))}
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-black/10 px-3 py-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[rgba(255,191,105,0.9)]" />
            High activity
          </span>
        </div>
        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
          Day number + count inside each cell
        </p>
      </div>

      <div className="overflow-x-auto rounded-[1.4rem] border border-white/8 bg-black/10 p-4">
        <div className="flex min-w-max gap-4">
          {months.map((monthStart) => {
            const monthEnd = endOfMonth(monthStart);
            const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
            const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
            const monthDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
            const monthTotal = monthDays.reduce((sum, date) => {
              if (!isSameMonth(date, monthStart)) {
                return sum;
              }

              return sum + (daysByKey.get(getHeatmapKey(date)) ?? 0);
            }, 0);

            return (
              <section
                key={monthStart.toISOString()}
                className="w-[18.5rem] rounded-3xl border border-white/8 bg-black/10 p-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-100">
                      {format(monthStart, "MMMM yyyy")}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">
                      Weekly day grid
                    </p>
                  </div>
                  <div className="text-right text-[10px] uppercase tracking-[0.22em] text-stone-500">
                    <p>{monthTotal} additions</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-7 gap-1 text-[10px] uppercase tracking-[0.18em] text-stone-500">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayLabel) => (
                    <span key={dayLabel} className="text-center">
                      {dayLabel}
                    </span>
                  ))}
                </div>

                <div
                  className="mt-2 grid grid-cols-7 gap-1"
                  style={{
                    gridAutoRows: "3.35rem",
                  }}
                >
                  {monthDays.map((date) => {
                    const inMonth = isSameMonth(date, monthStart);
                    const value = daysByKey.get(getHeatmapKey(date)) ?? 0;
                    const opacity = value === 0 ? 0.07 : 0.1 + (value / max) * 0.8;

                    return (
                      <div
                        key={date.toISOString()}
                        title={`${format(date, "EEE, MMM d")}: ${value} additions`}
                        className={`relative overflow-hidden rounded-2xl border p-2 transition ${
                          inMonth ? "border-white/10" : "border-white/5 opacity-40"
                        }`}
                        style={{
                          backgroundColor: inMonth
                            ? `rgba(255, 191, 105, ${opacity})`
                            : "rgba(255,255,255,0.02)",
                        }}
                      >
                        <div className="flex h-full flex-col justify-between">
                          <span className="text-[11px] font-medium text-stone-100">
                            {format(date, "d")}
                          </span>
                          <span className="self-end rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] font-medium text-stone-100">
                            {inMonth ? value : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
        Each month is laid out as a calendar. The number in the corner is the song count for that day.
      </p>
    </div>
  );
}

function HorizontalBarChart({ items }: { items: HorizontalBarItem[] }) {
  if (!items.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/10 text-sm text-stone-400">
        No ranking data yet.
      </div>
    );
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-white/8 bg-black/10 p-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-stone-100">{item.label}</p>
              {item.meta ? <p className="text-xs text-stone-400">{item.meta}</p> : null}
            </div>
            <p className="text-sm text-stone-300">{item.valueLabel}</p>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/6">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,_rgba(255,191,105,0.95),_rgba(106,161,109,0.95))]"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function HistogramChart({ bins }: { bins: HistogramBucket[] }) {
  if (!bins.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/10 text-sm text-stone-400">
        No removal history yet.
      </div>
    );
  }

  const max = Math.max(...bins.map((bin) => bin.value), 1);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {bins.map((bin) => (
          <div key={bin.label} className="rounded-2xl border border-white/8 bg-black/10 p-3">
            <div className="flex h-44 items-end">
              <div
                className="w-full rounded-t-2xl bg-[linear-gradient(180deg,_rgba(255,191,105,0.96),_rgba(106,161,109,0.9))]"
                style={{ height: `${(bin.value / max) * 100}%` }}
              />
            </div>
            <p className="mt-3 text-center text-xs uppercase tracking-[0.24em] text-stone-500">
              {bin.label}
            </p>
            <p className="mt-1 text-center text-sm font-medium text-stone-100">{bin.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActiveTrendCard({
  title,
  eyebrow,
  description,
  points,
  accent = "rgba(255, 191, 105, 0.95)",
  labels,
}: {
  title: string;
  eyebrow: string;
  description: string;
  points: TimeSeriesPoint[];
  accent?: string;
  labels?: string;
}) {
  return (
    <ChartShell title={title} eyebrow={eyebrow} description={description}>
      <LineChart points={points} accent={accent} labels={labels} />
    </ChartShell>
  );
}

export function ContributorShareCard({
  title,
  eyebrow,
  description,
  buckets,
}: {
  title: string;
  eyebrow: string;
  description: string;
  buckets: ContributorShareBucket[];
}) {
  return (
    <ChartShell title={title} eyebrow={eyebrow} description={description}>
      <StackedAreaChart buckets={buckets} />
    </ChartShell>
  );
}

export function HeatmapCard({
  title,
  eyebrow,
  description,
  days,
}: {
  title: string;
  eyebrow: string;
  description: string;
  days: HeatmapDay[];
}) {
  return (
    <ChartShell title={title} eyebrow={eyebrow} description={description}>
      <HeatmapChart days={days} />
    </ChartShell>
  );
}

export function RankingBarCard({
  title,
  eyebrow,
  description,
  items,
}: {
  title: string;
  eyebrow: string;
  description: string;
  items: HorizontalBarItem[];
}) {
  return (
    <ChartShell title={title} eyebrow={eyebrow} description={description}>
      <HorizontalBarChart items={items} />
    </ChartShell>
  );
}

export function HistogramCard({
  title,
  eyebrow,
  description,
  bins,
}: {
  title: string;
  eyebrow: string;
  description: string;
  bins: HistogramBucket[];
}) {
  return (
    <ChartShell title={title} eyebrow={eyebrow} description={description}>
      <HistogramChart bins={bins} />
    </ChartShell>
  );
}

export function toBarItems(
  rows: Array<{
    label: string;
    value: number;
    valueLabel: string;
    meta?: string;
  }>,
) {
  return rows;
}

export function formatLifetimeLabel(ms: number) {
  return formatLifetimeMs(ms);
}
