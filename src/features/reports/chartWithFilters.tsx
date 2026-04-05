"use client";

import ReactECharts from "echarts-for-react";
import { Empty, Table } from "antd";
import type { CSSProperties } from "react";
import type { ColumnsType } from "antd/es/table";
import type { ReportChart } from "@/features/reports/types";

type Props = {
  chart: ReportChart;
  height?: number;
};

type HeaderGroup = {
  group_name: string;
  start_col: string;
  end_col: string;
  bg_color?: string;
  font_color?: string;
};

type GroupRange = {
  group: HeaderGroup;
  start: number;
  end: number;
};

const HEADER_COLOR_MAP: Record<string, string> = {
  deep_blue: "#1F4E78",
  blue: "#2F75B5",
  white: "#FFFFFF",
};

const GROUP_BODY_BG_MAP: Record<string, string> = {
  "pool name": "#C7D1E0",
  "baseline metrics": "#C7D1E0",
  "current period": "#EBDCB7",
};

const TOKEN_STYLE_MAP: Record<string, CSSProperties> = {
  bg_light_blue: { backgroundColor: "#DDEBF7" },
  bg_light_yellow: { backgroundColor: "#FFF2CC" },
  bg_light_green: { backgroundColor: "#E2F0D9" },
  bg_light_red: { backgroundColor: "#FCE4D6" },
  font_red: { color: "#C00000" },
  font_green: { color: "#2E7D32" },
  font_blue: { color: "#1F4E78" },
  font_orange: { color: "#ED7D31" },
  font_white: { color: "#FFFFFF" },
  bold: { fontWeight: 700 },
  italic: { fontStyle: "italic" },
  underline: { textDecoration: "underline" },
  border_top_thick: { borderTop: "3px solid #1F4E78" },
};

function buildCellStyle(tokens: string[]): CSSProperties {
  return tokens.reduce<CSSProperties>((acc, token) => ({ ...acc, ...(TOKEN_STYLE_MAP[token] || {}) }), {});
}

function normalizeHeaderColor(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const key = value.trim().toLowerCase();
  return HEADER_COLOR_MAP[key] || value;
}

function normalizeGroupName(name: string): string {
  return name.trim().toLowerCase();
}

function resolveChildHeaderColor(group: HeaderGroup): { bg: string; color: string } {
  const bg = normalizeHeaderColor(group.bg_color) || "#2F75B5";
  const color = normalizeHeaderColor(group.font_color) || "#FFFFFF";
  return { bg, color };
}

function prettifyColumnTitle(columnKey: string, fallbackTitle: string): string {
  const key = columnKey.trim().toLowerCase();
  const preset: Record<string, string> = {
    pool_name: "Pool Name",
    baseline_balance: "Balance ($M)",
    baseline_wac: "WAC (%)",
    baseline_wala: "WALA (mo)",
    current_balance: "Balance ($M)",
    current_wac: "WAC (%)",
    current_wala: "WALA (mo)",
    diff_balance: "Diff ($M)",
    diff_pct: "Diff (%)",
    result: "Result",
  };
  if (preset[key]) {
    return preset[key];
  }
  return fallbackTitle;
}

function formatDisplayValue(columnKey: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  const key = columnKey.trim().toLowerCase();
  if (key !== "diff_balance" && key !== "diff_pct") {
    return value;
  }
  const text = String(value).trim();
  if (!text || text.startsWith("+") || text.startsWith("-") || text.startsWith("—")) {
    return value;
  }
  const numeric = Number(text.replace(/,/g, "").replace(/%/g, ""));
  if (!Number.isNaN(numeric) && numeric > 0) {
    return key === "diff_pct" && !text.includes("%") ? `+${text}%` : `+${text}`;
  }
  return value;
}

function hasBackgroundStyle(style: CSSProperties | undefined): boolean {
  return Boolean(style && (style.background || style.backgroundColor));
}

function buildGroupRanges(columns: Array<{ key: string; title: string; align?: string }>, groups: HeaderGroup[]): GroupRange[] {
  return groups
    .map((group) => {
      const start = columns.findIndex((column) => column.key === group.start_col);
      const end = columns.findIndex((column) => column.key === group.end_col);
      return { group, start, end };
    })
    .filter((item) => item.start >= 0 && item.end >= 0 && item.end >= item.start);
}

function buildColumnsWithGroups(
  columns: Array<{ key: string; title: string; align?: string }>,
  groups: HeaderGroup[],
  cellStyleMap: Map<string, CSSProperties>,
): ColumnsType<Record<string, unknown>> {
  const groupRanges = buildGroupRanges(columns, groups);
  const groupNameByColumn = new Map<string, string>();
  groupRanges.forEach(({ group, start, end }) => {
    for (let index = start; index <= end; index += 1) {
      groupNameByColumn.set(columns[index].key, group.group_name);
    }
  });

  const base = columns.map((column) => ({
    title: prettifyColumnTitle(column.key, column.title),
    dataIndex: column.key,
    key: column.key,
    render: (value: unknown) => formatDisplayValue(column.key, value),
    onCell: (_row: Record<string, unknown>, rowIndex?: number) => {
      if (rowIndex === undefined) {
        return {};
      }
      const style = cellStyleMap.get(`${rowIndex}:${column.key}`);
      if (hasBackgroundStyle(style)) {
        return style ? { style } : {};
      }

      const groupName = normalizeGroupName(groupNameByColumn.get(column.key) || "");
      const groupBg = GROUP_BODY_BG_MAP[groupName];
      if (!groupBg) {
        return style ? { style } : {};
      }

      return {
        style: {
          ...style,
          backgroundColor: groupBg,
        },
      };
    },
  }));

  if (!groups.length) {
    return base;
  }

  const consumed = new Set<number>();
  const grouped: ColumnsType<Record<string, unknown>> = [];

  for (const { group, start, end } of groupRanges) {
    if (start === end) {
      consumed.add(start);
      const { bg, color } = resolveChildHeaderColor(group);
      grouped.push({
        ...base[start],
        title: (
          <span
            style={{
              background: bg,
              color,
              display: "inline-block",
              width: "100%",
              textAlign: "center",
              fontWeight: 700,
              padding: "8px 0",
            }}
          >
            {group.group_name}
          </span>
        ),
        onHeaderCell: () => ({ rowSpan: 2 }),
      });
      continue;
    }

    const children = base.slice(start, end + 1);
    if (!children.length) {
      continue;
    }

    for (let index = start; index <= end; index += 1) {
      consumed.add(index);
    }

    const { bg, color } = resolveChildHeaderColor(group);
    const styledChildren = children.map((child) => ({
      ...child,
      title: (
        <span
          style={{
            background: bg,
            color,
            display: "inline-block",
            width: "100%",
            textAlign: "center",
            fontWeight: 700,
            padding: "6px 0",
          }}
        >
          {child.title as string}
        </span>
      ),
    }));

    grouped.push({
      key: `group:${group.group_name}:${group.start_col}:${group.end_col}`,
      title: (
        <span
          style={{
            background: normalizeHeaderColor(group.bg_color),
            color: normalizeHeaderColor(group.font_color),
            display: "inline-block",
            width: "100%",
            textAlign: "center",
            fontWeight: 700,
            padding: "2px 0",
          }}
        >
          {group.group_name}
        </span>
      ),
      children: styledChildren,
    });
  }

  columns.forEach((column, index) => {
    if (!consumed.has(index)) {
      grouped.push(base[index]);
    }
  });

  return grouped.length ? grouped : base;
}

function normalizeEchartsOption(option: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...option };
  const seriesRaw = Array.isArray(option.series) ? option.series : [];
  const series = seriesRaw.map((item) => (item && typeof item === "object" ? { ...(item as Record<string, unknown>) } : item));

  if (!series.length) {
    return next;
  }

  const first = series[0];
  if (!first || typeof first !== "object") {
    return next;
  }

  const topMarkArea = option.markArea;
  const topMarkLine = option.markLine;
  const typedFirst = first as Record<string, unknown>;

  if (!typedFirst.markArea && topMarkArea && typeof topMarkArea === "object") {
    typedFirst.markArea = topMarkArea;
  }
  if (!typedFirst.markLine && topMarkLine && typeof topMarkLine === "object") {
    typedFirst.markLine = topMarkLine;
  }

  series[0] = typedFirst;
  next.series = series;
  return next;
}

export function ChartWithFilters({ chart, height = 380 }: Props) {
  const rawColumns = chart.table_data?.columns || [];
  const tableRows = chart.table_data?.rows || [];
  const presentation = chart.table_data?.presentation;
  const cellStyles = presentation?.cell_styles || [];
  const headerGroups = (presentation?.header_groups || []) as HeaderGroup[];

  const cellStyleMap = new Map<string, CSSProperties>();
  for (const item of cellStyles) {
    if (!Array.isArray(item.tokens) || !item.tokens.length) {
      continue;
    }
    cellStyleMap.set(`${item.row_index}:${item.column}`, buildCellStyle(item.tokens));
  }

  const tableColumns = buildColumnsWithGroups(rawColumns, headerGroups, cellStyleMap);

  if (chart.chart_type === "table") {
    return (
      <Table
        size="small"
        pagination={false}
        rowKey="__rowKey"
        columns={tableColumns}
        dataSource={tableRows.map((row, index) => ({
          ...row,
          __rowKey: `${chart.chart_id}-${index}`,
        }))}
      />
    );
  }

  if (chart.echarts) {
    const normalizedOption = normalizeEchartsOption(chart.echarts);
    return <ReactECharts option={normalizedOption} notMerge lazyUpdate style={{ width: "100%", height }} />;
  }

  return <Empty description="该图表无 echarts option 数据" />;
}
