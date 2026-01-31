"use client";

// =============================================================================
// PeopleOS PH - Chart Components
// =============================================================================
// Reusable chart components using pure CSS/SVG for visualizations.
// No external charting library required.
// =============================================================================

import { cn } from "@/lib/utils";

// =============================================================================
// BAR CHART
// =============================================================================

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  showValues?: boolean;
  horizontal?: boolean;
  height?: number;
  className?: string;
}

export function BarChart({
  data,
  maxValue,
  showValues = true,
  horizontal = true,
  height = 200,
  className,
}: BarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-yellow-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-orange-500",
  ];

  if (horizontal) {
    return (
      <div className={cn("space-y-2", className)}>
        {data.map((item, index) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-24 text-sm text-gray-600 truncate" title={item.label}>
              {item.label}
            </div>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  item.color || colors[index % colors.length]
                )}
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
            {showValues && (
              <div className="w-12 text-sm text-gray-700 text-right font-medium">
                {item.value.toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Vertical bars
  return (
    <div className={cn("flex items-end justify-around gap-2", className)} style={{ height }}>
      {data.map((item, index) => (
        <div key={item.label} className="flex flex-col items-center flex-1">
          <div className="flex-1 w-full flex items-end justify-center">
            <div
              className={cn(
                "w-8 rounded-t transition-all duration-500",
                item.color || colors[index % colors.length]
              )}
              style={{ height: `${(item.value / max) * 100}%`, minHeight: "4px" }}
            />
          </div>
          {showValues && (
            <div className="text-xs text-gray-700 font-medium mt-1">
              {item.value.toLocaleString()}
            </div>
          )}
          <div className="text-xs text-gray-500 truncate max-w-full mt-1" title={item.label}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// DONUT CHART
// =============================================================================

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  showLegend?: boolean;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
}

export function DonutChart({
  data,
  size = 160,
  thickness = 24,
  showLegend = true,
  centerLabel,
  centerValue,
  className,
}: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <div className={cn("flex items-center gap-6", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={thickness}
          />
          {/* Data segments */}
          {data.map((item, index) => {
            const percent = total > 0 ? item.value / total : 0;
            const strokeDasharray = `${circumference * percent} ${circumference}`;
            const strokeDashoffset = -circumference * cumulativePercent;
            cumulativePercent += percent;

            return (
              <circle
                key={index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={thickness}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>
        {/* Center content */}
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && (
              <span className="text-2xl font-bold text-gray-900">{centerValue}</span>
            )}
            {centerLabel && (
              <span className="text-xs text-gray-500">{centerLabel}</span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className="text-sm font-medium text-gray-900 ml-auto">
                {item.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PROGRESS RING
// =============================================================================

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  thickness?: number;
  color?: string;
  bgColor?: string;
  label?: string;
  showPercent?: boolean;
  className?: string;
}

export function ProgressRing({
  value,
  max = 100,
  size = 80,
  thickness = 8,
  color = "#3b82f6",
  bgColor = "#e5e7eb",
  label,
  showPercent = true,
  className,
}: ProgressRingProps) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.min(value / max, 1);
  const strokeDashoffset = circumference * (1 - percent);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={bgColor}
            strokeWidth={thickness}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700"
          />
        </svg>
        {showPercent && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-gray-900">
              {Math.round(percent * 100)}%
            </span>
          </div>
        )}
      </div>
      {label && <span className="text-sm text-gray-600 mt-2">{label}</span>}
    </div>
  );
}

// =============================================================================
// STAT CARD
// =============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  icon?: React.ReactNode;
  color?: "blue" | "green" | "yellow" | "red" | "purple" | "gray";
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = "blue",
  className,
}: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
    gray: "bg-gray-50 text-gray-600",
  };

  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 p-6", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={cn(
                  "text-sm font-medium",
                  trend.isPositive ? "text-green-600" : "text-red-600"
                )}
              >
                {trend.isPositive ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-xs text-gray-500">vs last month</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={cn("p-3 rounded-lg", colorClasses[color])}>{icon}</div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MINI SPARKLINE
// =============================================================================

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = 100,
  height = 32,
  color = "#3b82f6",
  className,
}: SparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className={className}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// =============================================================================
// DATA TABLE
// =============================================================================

interface DataTableProps<T> {
  columns: { key: keyof T | string; label: string; align?: "left" | "center" | "right" }[];
  data: T[];
  maxRows?: number;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  maxRows,
  className,
}: DataTableProps<T>) {
  const displayData = maxRows ? data.slice(0, maxRows) : data;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cn(
                  "py-3 px-4 font-medium text-gray-500",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  (!col.align || col.align === "left") && "text-left"
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, idx) => (
            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  className={cn(
                    "py-3 px-4 text-gray-700",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center"
                  )}
                >
                  {String(row[col.key as keyof T] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {maxRows && data.length > maxRows && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          Showing {maxRows} of {data.length} rows
        </p>
      )}
    </div>
  );
}
