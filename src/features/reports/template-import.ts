import * as XLSX from "xlsx";
import type { ReportChart, ReportSection } from "@/features/reports/types";

type RawRow = Record<string, unknown>;

type TemplateKind = "facet" | "timeseries";

type XSemantic = "time" | "numeric" | "unknown";

type TemplateRow = {
  x: string | number | Date | null;
  y: number | null;
  panel: string;
  legend: string;
  type: string;
  shape: string;
  lineStyle: string;
  lineWidth: number;
  pointSize: number;
  color: string;
  yFormat: string;
};

export type TemplateImportResult = {
  kind: TemplateKind;
  title: string;
  subtitle: string;
  sections: ReportSection[];
  stats: {
    panels: number;
    charts: number;
    points: number;
  };
  warnings: string[];
};

export async function parseTemplateWorkbook(file: File): Promise<TemplateImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const cfgSheet = workbook.Sheets["chart_config"];
  const dataSheet = workbook.Sheets["chart_data"];

  if (!cfgSheet || !dataSheet) {
    throw new Error("模板必须包含 chart_config 和 chart_data 两个 sheet");
  }

  const cfgRows = XLSX.utils.sheet_to_json<{ key?: string; value?: unknown }>(cfgSheet, {
    defval: null,
    raw: true,
  });
  const cfg = toConfigMap(cfgRows);

  const dictionarySheet = workbook.Sheets["column_dictionary"];
  const dictionaryRows = dictionarySheet
    ? XLSX.utils.sheet_to_json<RawRow>(dictionarySheet, { defval: null, raw: true })
    : [];
  const xSemantic = detectXSemanticFromDictionary(dictionaryRows);

  const rawDataRows = XLSX.utils.sheet_to_json<RawRow>(dataSheet, {
    defval: null,
    raw: true,
  });

  if (!rawDataRows.length) {
    throw new Error("chart_data 没有可用数据");
  }

  const rows = rawDataRows.map(normalizeTemplateRow);
  const kind = detectTemplateKind(rows, xSemantic);
  const normalizedRows = normalizeRowsForKind(rows, kind);
  const warnings = collectWarnings(normalizedRows, kind);

  const section = buildSectionFromRows(normalizedRows, kind, {
    sectionKey: "section_1",
    title: cfg.title || `Imported ${kind} Charts`,
    subtitle: cfg.subtitle,
  });

  return {
    kind,
    title: cfg.title || "Imported Report",
    subtitle: cfg.subtitle,
    sections: [section],
    stats: {
      panels: section.content_items?.charts?.length || 0,
      charts: section.content_items?.charts?.length || 0,
      points: normalizedRows.filter((row) => row.y !== null).length,
    },
    warnings,
  };
}

function toConfigMap(rows: Array<{ key?: string; value?: unknown }>): { title: string; subtitle: string } {
  const map = new Map<string, string>();

  rows.forEach((row) => {
    const key = String(row.key || "").trim();
    if (!key) {
      return;
    }
    map.set(key, String(row.value ?? ""));
  });

  return {
    title: map.get("title") || "",
    subtitle: map.get("subtitle") || "",
  };
}

function normalizeTemplateRow(raw: RawRow): TemplateRow {
  return {
    x: normalizeX(raw.x),
    y: toNumber(raw.y),
    panel: String(raw.panel ?? "Chart 1"),
    legend: String(raw.legend ?? "Series"),
    type: String(raw.type ?? "line").toLowerCase(),
    shape: String(raw.shape ?? "none").toLowerCase(),
    lineStyle: String(raw.line_style ?? "solid").toLowerCase(),
    lineWidth: toNumber(raw.line_width) ?? 2,
    pointSize: toNumber(raw.point_size) ?? 0,
    color: String(raw.color ?? "#5470C6"),
    yFormat: String(raw.y_format ?? "").trim(),
  };
}

function normalizeX(input: unknown): string | number | Date | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (input instanceof Date) {
    return input;
  }

  if (typeof input === "number") {
    return input;
  }

  const text = String(input).trim();
  if (!text) {
    return null;
  }

  const asDate = parseDateValue(text);
  if (asDate) {
    return asDate;
  }

  const asNumber = Number(text);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }

  return text;
}

function toNumber(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? input : null;
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed.replace(/,/g, ""));
    return Number.isNaN(numeric) ? null : numeric;
  }

  return null;
}

function detectTemplateKind(rows: TemplateRow[], xSemantic: XSemantic): TemplateKind {
  if (xSemantic === "time") {
    return "timeseries";
  }

  if (xSemantic === "numeric") {
    return "facet";
  }

  const hasYFormat = rows.some((row) => row.yFormat !== "");
  if (hasYFormat) {
    return "timeseries";
  }

  const dateLike = rows.filter((row) => row.x instanceof Date).length;
  if (dateLike / Math.max(rows.length, 1) > 0.7) {
    return "timeseries";
  }

  // Excel date serials are usually in this range; treat as time-series when dominant.
  const excelSerialLike = rows.filter((row) => typeof row.x === "number" && row.x > 20000 && row.x < 80000).length;
  if (excelSerialLike / Math.max(rows.length, 1) > 0.7) {
    return "timeseries";
  }

  return "facet";
}

function normalizeRowsForKind(rows: TemplateRow[], kind: TemplateKind): TemplateRow[] {
  if (kind !== "timeseries") {
    return rows;
  }

  return rows.map((row) => {
    if (row.x === null) {
      return row;
    }

    if (row.x instanceof Date) {
      return {
        ...row,
        x: formatDateKey(row.x),
      };
    }

    if (typeof row.x === "number") {
      const serialDate = excelSerialToDate(row.x);
      if (serialDate) {
        return {
          ...row,
          x: formatDateKey(serialDate),
        };
      }
    }

    if (typeof row.x === "string") {
      const parsed = parseDateValue(row.x);
      if (parsed) {
        return {
          ...row,
          x: formatDateKey(parsed),
        };
      }
    }

    return row;
  });
}

function collectWarnings(rows: TemplateRow[], kind: TemplateKind): string[] {
  const warnings: string[] = [];

  const missingY = rows.filter((row) => row.y === null).length;
  if (missingY > 0) {
    warnings.push(`${missingY} 行 y 值为空，已在绘图时忽略`);
  }

  if (kind === "timeseries") {
    const invalidDate = rows.filter((row) => !isValidTimeX(row.x)).length;
    if (invalidDate > 0) {
      warnings.push(`${invalidDate} 行 x 不是日期，已按原值处理`);
    }
  }

  return warnings;
}

function buildSectionFromRows(
  rows: TemplateRow[],
  kind: TemplateKind,
  input: { sectionKey: string; title: string; subtitle: string },
): ReportSection {
  const panelGroups = groupByPanel(rows);
  const panelKeys = Array.from(panelGroups.keys()).sort(comparePanelKey);

  const charts: ReportChart[] = panelKeys.map((panelKey, index) => {
    const panelRows = panelGroups.get(panelKey) || [];
    return {
      chart_id: `chart_${index + 1}`,
      chart_type: "line",
      title: panelKey,
      subtitle: null,
      echarts: buildOptionForPanel(panelRows, kind),
      table_data: null,
      meta: {
        source_template: kind,
        panel: panelKey,
      },
    };
  });

  return {
    section_key: input.sectionKey,
    title: input.title || "Imported Section",
    subtitle: input.subtitle || null,
    order: 1,
    content_items: {
      charts,
    },
  };
}

function buildOptionForPanel(rows: TemplateRow[], kind: TemplateKind): Record<string, unknown> {
  const legendGroups = new Map<string, TemplateRow[]>();
  rows.forEach((row) => {
    if (!legendGroups.has(row.legend)) {
      legendGroups.set(row.legend, []);
    }
    legendGroups.get(row.legend)?.push(row);
  });

  const xValues = buildXAxisValues(rows, kind);

  const series = Array.from(legendGroups.entries()).map(([legend, points]) => {
    const rowStyle = points[0];
    const pointMap = buildPointMap(points, kind);

    const data = kind === "timeseries"
      ? points
          .filter((item) => item.y !== null)
          .map((item) => {
            return [String(item.x), item.y];
          })
      : xValues.map((xValue) => {
          const y = pointMap.get(String(xValue));
          return y === undefined ? null : y;
        });

    const lineType = toEchartsLineType(rowStyle.lineStyle);
    const symbol = toEchartsSymbol(rowStyle.shape);
    const isLineType = rowStyle.type.includes("line");
    const isPointType = rowStyle.type.includes("point");

    return {
      name: legend,
      type: "line",
      data,
      connectNulls: true,
      showSymbol: isPointType,
      symbol,
      symbolSize: Math.max(2, rowStyle.pointSize / 2),
      lineStyle: {
        type: lineType,
        width: isLineType ? Math.max(1, rowStyle.lineWidth / 2) : 0,
      },
      itemStyle: {
        color: rowStyle.color,
      },
    };
  });

  const first = rows[0];
  const yFormat = first?.yFormat || "";

  return {
    tooltip: { trigger: "axis" },
    legend: {
      show: true,
      bottom: 0,
    },
    grid: { left: 50, right: 20, top: 40, bottom: 45 },
    xAxis:
      kind === "timeseries"
        ? {
            type: "time",
            axisLabel: { hideOverlap: true },
          }
        : {
            type: "category",
            data: xValues,
          },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: toAxisLabelTemplate(yFormat, kind),
      },
    },
    series,
    animation: false,
  };
}

function buildXAxisValues(rows: TemplateRow[], kind: TemplateKind): Array<string | number> {
  if (kind === "timeseries") {
    return [];
  }

  const values = rows
    .map((row) => row.x)
    .filter((item): item is string | number => item !== null && !(item instanceof Date));

  const unique = Array.from(new Set(values.map((item) => String(item))));

  const allNumeric = unique.every((item) => !Number.isNaN(Number(item)));
  if (allNumeric) {
    return unique.map((item) => Number(item)).sort((a, b) => a - b);
  }

  return unique;
}

function buildPointMap(rows: TemplateRow[], kind: TemplateKind): Map<string, number | null> {
  const map = new Map<string, number | null>();

  rows.forEach((row) => {
    if (row.y === null) {
      return;
    }

    const key =
      kind === "timeseries"
        ? String(row.x)
        : String(row.x);
    map.set(key, row.y);
  });

  return map;
}

function groupByPanel(rows: TemplateRow[]): Map<string, TemplateRow[]> {
  const map = new Map<string, TemplateRow[]>();

  rows.forEach((row) => {
    if (!map.has(row.panel)) {
      map.set(row.panel, []);
    }
    map.get(row.panel)?.push(row);
  });

  return map;
}

function comparePanelKey(a: string, b: string): number {
  const n1 = getTrailingNumber(a);
  const n2 = getTrailingNumber(b);

  if (n1 !== null && n2 !== null) {
    return n1 - n2;
  }

  return a.localeCompare(b);
}

function getTrailingNumber(value: string): number | null {
  const matched = value.match(/(\d+)$/);
  if (!matched) {
    return null;
  }

  return Number(matched[1]);
}

function toEchartsSymbol(shape: string): string {
  if (shape === "circle") {
    return "circle";
  }
  if (shape === "square") {
    return "rect";
  }
  if (shape === "diamond") {
    return "diamond";
  }
  if (shape === "triangle") {
    return "triangle";
  }
  return "none";
}

function toEchartsLineType(lineStyle: string): string | number[] {
  if (lineStyle === "dashed") {
    return "dashed";
  }
  if (lineStyle === "dotted") {
    return "dotted";
  }
  if (lineStyle === "dashdot") {
    return [6, 3, 1, 3];
  }
  if (lineStyle === "none") {
    return "solid";
  }
  return "solid";
}

function toAxisLabelTemplate(yFormat: string, kind: TemplateKind): string {
  if (yFormat === "%") {
    return "{value}%";
  }
  if (yFormat === "bp") {
    return "{value} bp";
  }
  if (yFormat === "x") {
    return "{value}x";
  }

  if (kind === "facet") {
    return "{value}%";
  }

  return "{value}";
}

function parseDateValue(input: string): Date | null {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function detectXSemanticFromDictionary(rows: RawRow[]): XSemantic {
  const xRow = rows.find((row) => String(row.column_name || "").trim().toLowerCase() === "x");
  if (!xRow) {
    return "unknown";
  }

  const text = [xRow.chinese_name, xRow.description, xRow.example_values]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  if (
    text.includes("日期") ||
    text.includes("date") ||
    text.includes("time") ||
    text.includes("年月")
  ) {
    return "time";
  }

  if (
    text.includes("连续") ||
    text.includes("整数") ||
    text.includes("numeric") ||
    text.includes("number")
  ) {
    return "numeric";
  }

  return "unknown";
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isValidTimeX(value: TemplateRow["x"]): boolean {
  if (value === null) {
    return false;
  }

  if (value instanceof Date) {
    return true;
  }

  if (typeof value === "string") {
    return parseDateValue(value) !== null;
  }

  return false;
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) {
    return null;
  }

  const ms = Date.UTC(1899, 11, 30) + serial * 24 * 60 * 60 * 1000;
  const date = new Date(ms);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}
