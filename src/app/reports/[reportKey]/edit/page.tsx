"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import ReactECharts from "echarts-for-react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tree,
  Typography,
  message,
} from "antd";
import type { DataNode } from "antd/es/tree";
import { useReportDetailQuery, useUpdateReportMutation } from "@/features/reports/hooks";
import type { ReportChart, ReportDetail } from "@/features/reports/types";
import { http } from "@/lib/http";

type Scalar = string | number | null;
type DataRow = Record<string, Scalar>;

type ChartBinding = {
  xField: string;
  seriesField: string;
  valueField: string;
  chartType: "line" | "bar";
};

type ChartEditorState = {
  rowsText: string;
  binding: ChartBinding;
};

export default function ReportEditPage() {
  const { reportKey } = useParams<{ reportKey: string }>();
  const [messageApi, contextHolder] = message.useMessage();

  const detailQuery = useReportDetailQuery(reportKey);

  if (detailQuery.isLoading || !detailQuery.data) {
    return (
      <Card>
        <Spin />
      </Card>
    );
  }

  return (
    <ReportEditorWorkspace
      reportKey={reportKey}
      initialReport={detailQuery.data}
      onError={(text) => messageApi.error(text)}
      onSuccess={(text) => messageApi.success(text)}
      contextHolder={contextHolder}
    />
  );
}

function ReportEditorWorkspace({
  reportKey,
  initialReport,
  onSuccess,
  onError,
  contextHolder,
}: {
  reportKey: string;
  initialReport: ReportDetail;
  onSuccess: (text: string) => void;
  onError: (text: string) => void;
  contextHolder: React.ReactElement;
}) {
  const updateMutation = useUpdateReportMutation();

  const [draft, setDraft] = useState<ReportDetail>(() => cloneReport(initialReport));
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>(() => {
    const firstSection = [...initialReport.sections].sort((a, b) => (a.order || 0) - (b.order || 0))[0];
    return firstSection?.section_key || "";
  });
  const [selectedChartId, setSelectedChartId] = useState<string>(() => {
    const firstSection = [...initialReport.sections].sort((a, b) => (a.order || 0) - (b.order || 0))[0];
    return firstSection?.content_items?.charts?.[0]?.chart_id || "";
  });
  const [editorMap, setEditorMap] = useState<Record<string, ChartEditorState>>({});

  const sections = [...(draft.sections || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const selectedSection = sections.find((item) => item.section_key === selectedSectionKey);
  const selectedChart = selectedSection?.content_items?.charts?.find((item) => item.chart_id === selectedChartId);

  const treeData: DataNode[] = sections.map((section) => ({
    key: `section:${section.section_key}`,
    title: `${section.title} (${section.section_key})`,
    children: (section.content_items?.charts || []).map((chart) => ({
      key: `chart:${section.section_key}:${chart.chart_id}`,
      title: `${chart.title} [${chart.chart_type}]`,
      isLeaf: true,
    })),
  }));

  const selectedEditorState = getEditorState(selectedChart, editorMap);
  const editableRows = parseRowsText(selectedEditorState?.rowsText || "[]");
  const rowFields = getRowFields(editableRows);
  const previewOption =
    selectedChart && selectedEditorState && selectedChart.chart_type !== "table"
      ? buildOptionFromRows(editableRows, selectedEditorState.binding, selectedChart)
      : null;

  const onSelectTree = (keys: React.Key[]) => {
    const key = String(keys[0] || "");

    if (key.startsWith("section:")) {
      const sectionKey = key.replace("section:", "");
      setSelectedSectionKey(sectionKey);
      const section = sections.find((item) => item.section_key === sectionKey);
      const firstChart = section?.content_items?.charts?.[0];
      setSelectedChartId(firstChart?.chart_id || "");
      return;
    }

    if (key.startsWith("chart:")) {
      const [, sectionKey, chartId] = key.split(":");
      setSelectedSectionKey(sectionKey || "");
      setSelectedChartId(chartId || "");
    }
  };

  const updateSelectedEditorState = (next: Partial<ChartEditorState>) => {
    if (!selectedChart) {
      return;
    }

    setEditorMap((prev) => {
      const current = getEditorState(selectedChart, prev);
      if (!current) {
        return prev;
      }

      return {
        ...prev,
        [selectedChart.chart_id]: {
          ...current,
          ...next,
          binding: {
            ...current.binding,
            ...(next.binding || {}),
          },
        },
      };
    });
  };

  const addSection = () => {
    const nextDraft = cloneReport(draft);
    const sectionKey = nextSectionKey(nextDraft.sections);
    const chartId = nextChartId([]);

    const newSection = {
      section_key: sectionKey,
      title: `New Section ${nextDraft.sections.length + 1}`,
      subtitle: null,
      order: nextDraft.sections.length + 1,
      content_items: {
        charts: [createDefaultChart(chartId)],
      },
    };

    nextDraft.sections.push(newSection);
    setDraft(nextDraft);
    setSelectedSectionKey(sectionKey);
    setSelectedChartId(chartId);
    onSuccess("已新增 section");
  };

  const addChart = () => {
    if (!selectedSection) {
      onError("请先选择 section");
      return;
    }

    const nextDraft = cloneReport(draft);
    const targetSection = nextDraft.sections.find((item) => item.section_key === selectedSection.section_key);
    const charts = targetSection?.content_items?.charts || [];
    const chartId = nextChartId(charts);

    if (!targetSection) {
      return;
    }

    if (!targetSection.content_items) {
      targetSection.content_items = { charts: [] };
    }

    if (!targetSection.content_items.charts) {
      targetSection.content_items.charts = [];
    }

    targetSection.content_items.charts.push(createDefaultChart(chartId));
    setDraft(nextDraft);
    setSelectedChartId(chartId);
    onSuccess("已新增 chart");
  };

  const removeSelectedSection = () => {
    if (!selectedSection) {
      return;
    }

    const nextDraft = cloneReport(draft);
    nextDraft.sections = nextDraft.sections.filter((item) => item.section_key !== selectedSection.section_key);
    nextDraft.sections = nextDraft.sections.map((item, index) => ({
      ...item,
      order: index + 1,
    }));

    setDraft(nextDraft);

    const first = [...nextDraft.sections].sort((a, b) => (a.order || 0) - (b.order || 0))[0];
    setSelectedSectionKey(first?.section_key || "");
    setSelectedChartId(first?.content_items?.charts?.[0]?.chart_id || "");
    onSuccess("已删除 section");
  };

  const removeSelectedChart = () => {
    if (!selectedSection || !selectedChart) {
      return;
    }

    const nextDraft = cloneReport(draft);
    const targetSection = nextDraft.sections.find((item) => item.section_key === selectedSection.section_key);
    const charts = targetSection?.content_items?.charts || [];

    if (!targetSection || !targetSection.content_items || !targetSection.content_items.charts) {
      return;
    }

    targetSection.content_items.charts = charts.filter((item) => item.chart_id !== selectedChart.chart_id);
    setDraft(nextDraft);

    const firstChart = targetSection.content_items.charts[0];
    setSelectedChartId(firstChart?.chart_id || "");
    onSuccess("已删除 chart");
  };

  const applyBindingToChart = () => {
    if (!selectedSection || !selectedChart || !selectedEditorState) {
      return;
    }

    const rows = parseRowsText(selectedEditorState.rowsText);
    if (!rows.length) {
      onError("请先提供可用的数据行");
      return;
    }

    const nextDraft = cloneReport(draft);
    const targetSection = nextDraft.sections.find((item) => item.section_key === selectedSection.section_key);
    const targetChart = targetSection?.content_items?.charts?.find((item) => item.chart_id === selectedChart.chart_id);

    if (!targetChart) {
      return;
    }

    if (targetChart.chart_type === "table") {
      const columns = Object.keys(rows[0] || {}).map((key) => ({ key, title: key }));
      targetChart.table_data = {
        columns,
        rows,
      };
    } else {
      targetChart.chart_type = selectedEditorState.binding.chartType;
      targetChart.echarts = buildOptionFromRows(rows, selectedEditorState.binding, targetChart);
    }

    setDraft(nextDraft);
    onSuccess("已应用当前绑定配置到图表");
  };

  const saveDraft = async () => {
    try {
      const updated = await updateMutation.mutateAsync({
        reportKey,
        payload: {
          name: draft.name,
          type: draft.type,
          status: draft.status,
          sections: draft.sections,
        },
      });

      setDraft(cloneReport(updated));
      onSuccess("保存成功");
    } catch (error) {
      onError(
        `保存失败：${http.toErrorMessage(error)}。如果后端暂不支持 sections patch，请确认 CRUD 接口契约。`,
      );
    }
  };

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      {contextHolder}

      <Card
        title={`报告编辑器 · ${draft.name}`}
        extra={
          <Space>
            <Link href={`/reports/${reportKey}`}>
              <Button>返回预览</Button>
            </Link>
            <Button type="primary" loading={updateMutation.isPending} onClick={saveDraft}>
              保存草稿
            </Button>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          支持图表数据绑定和实时预览：上传 Excel，选择图表，配置字段绑定，应用到图表，保存草稿，再执行 Assemble 和 Publish。
        </Typography.Paragraph>

        <Row gutter={12}>
          <Col xs={24} md={8}>
            <Typography.Text type="secondary">name</Typography.Text>
            <Input
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Report Name"
            />
          </Col>
          <Col xs={24} md={8}>
            <Typography.Text type="secondary">type</Typography.Text>
            <Input
              value={draft.type}
              onChange={(event) => setDraft((prev) => ({ ...prev, type: event.target.value }))}
              placeholder="analytics"
            />
          </Col>
          <Col xs={24} md={8}>
            <Typography.Text type="secondary">status</Typography.Text>
            <Select
              value={draft.status}
              style={{ width: "100%" }}
              onChange={(value) => setDraft((prev) => ({ ...prev, status: value }))}
              options={[
                { label: "draft", value: "draft" },
                { label: "published", value: "published" },
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={16} align="top">
        <Col xs={24} lg={6}>
          <Card title="结构树" styles={{ body: { maxHeight: 700, overflowY: "auto" } }}>
            <Space style={{ marginBottom: 12 }} wrap>
              <Button size="small" onClick={addSection}>
                新增 Section
              </Button>
              <Button size="small" onClick={addChart} disabled={!selectedSection}>
                新增 Chart
              </Button>
            </Space>

            {treeData.length ? (
              <Tree
                treeData={treeData}
                onSelect={onSelectTree}
                defaultExpandAll
                selectedKeys={selectedChartId ? [`chart:${selectedSectionKey}:${selectedChartId}`] : []}
              />
            ) : (
              <Empty description="暂无 section/chart" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Section 预览（整段）" styles={{ body: { maxHeight: 700, overflowY: "auto" } }}>
            {selectedSection ? (
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {selectedSection.title}
                </Typography.Title>
                <Typography.Text type="secondary">{selectedSection.subtitle || "-"}</Typography.Text>

                {(selectedSection.content_items?.charts || []).map((chart) => {
                  const columns =
                    chart.table_data?.columns?.map((column) => ({
                      title: column.title,
                      dataIndex: column.key,
                      key: column.key,
                    })) || [];

                  return (
                    <Card key={chart.chart_id} type="inner" title={`${chart.title} (${chart.chart_id})`}>
                      <Space orientation="vertical" style={{ width: "100%" }}>
                        <Tag color={chart.chart_id === selectedChartId ? "processing" : "default"}>{chart.chart_type}</Tag>

                        {chart.chart_type !== "table" && chart.echarts ? (
                          <ReactECharts option={chart.echarts} notMerge lazyUpdate style={{ width: "100%", height: 320 }} />
                        ) : null}

                        {chart.chart_type === "table" ? (
                          <Table
                            size="small"
                            pagination={false}
                            rowKey={(_, index) => `${chart.chart_id}-${index}`}
                            columns={columns}
                            dataSource={chart.table_data?.rows || []}
                          />
                        ) : null}
                      </Space>
                    </Card>
                  );
                })}
              </Space>
            ) : (
              <Empty description="请先从左侧结构树选择一个 section" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card title="图表绑定配置" styles={{ body: { maxHeight: 700, overflowY: "auto" } }}>
            {selectedChart && selectedEditorState ? (
              <Space orientation="vertical" style={{ width: "100%" }}>
                <Typography.Text strong>{selectedChart.title}</Typography.Text>
                <Typography.Text type="secondary">chart_id: {selectedChart.chart_id}</Typography.Text>

                <Space wrap>
                  <Button size="small" onClick={addChart}>
                    在本 Section 新增 Chart
                  </Button>
                  <Button size="small" danger onClick={removeSelectedChart}>
                    删除当前 Chart
                  </Button>
                  <Button size="small" danger onClick={removeSelectedSection}>
                    删除当前 Section
                  </Button>
                </Space>

                {selectedChart.chart_type !== "table" ? (
                  <>
                    <Select
                      value={selectedEditorState.binding.chartType}
                      onChange={(value) =>
                        updateSelectedEditorState({
                          binding: { ...selectedEditorState.binding, chartType: value },
                        })
                      }
                      options={[
                        { label: "line", value: "line" },
                        { label: "bar", value: "bar" },
                      ]}
                    />

                    <Select
                      value={selectedEditorState.binding.xField}
                      onChange={(value) =>
                        updateSelectedEditorState({
                          binding: { ...selectedEditorState.binding, xField: value },
                        })
                      }
                      options={rowFields.map((field) => ({ label: `x: ${field}`, value: field }))}
                      placeholder="xField"
                    />

                    <Select
                      value={selectedEditorState.binding.seriesField}
                      onChange={(value) =>
                        updateSelectedEditorState({
                          binding: { ...selectedEditorState.binding, seriesField: value },
                        })
                      }
                      options={rowFields.map((field) => ({ label: `series: ${field}`, value: field }))}
                      placeholder="seriesField"
                    />

                    <Select
                      value={selectedEditorState.binding.valueField}
                      onChange={(value) =>
                        updateSelectedEditorState({
                          binding: { ...selectedEditorState.binding, valueField: value },
                        })
                      }
                      options={rowFields.map((field) => ({ label: `value: ${field}`, value: field }))}
                      placeholder="valueField"
                    />
                  </>
                ) : null}

                <Input.TextArea
                  value={selectedEditorState.rowsText}
                  onChange={(event) => updateSelectedEditorState({ rowsText: event.target.value })}
                  rows={14}
                  placeholder='[{"x":"2024-01","series":"Platform","value":123}]'
                />

                <Button onClick={applyBindingToChart}>应用到当前图表</Button>

                {selectedChart.chart_type !== "table" ? (
                  <Card size="small" title="预览（未应用）">
                    {previewOption ? (
                      <ReactECharts option={previewOption} notMerge lazyUpdate style={{ width: "100%", height: 240 }} />
                    ) : (
                      <Alert type="warning" showIcon message="当前绑定无法生成预览，请检查 rows JSON 与字段映射" />
                    )}
                  </Card>
                ) : null}
              </Space>
            ) : (
              <Empty description="请先选择一个 chart" />
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function cloneReport(report: ReportDetail): ReportDetail {
  return JSON.parse(JSON.stringify(report)) as ReportDetail;
}

function getEditorState(
  chart: ReportChart | undefined,
  map: Record<string, ChartEditorState>,
): ChartEditorState | undefined {
  if (!chart) {
    return undefined;
  }

  if (map[chart.chart_id]) {
    return map[chart.chart_id];
  }

  const rows = extractRowsFromChart(chart);
  const binding = inferBinding(rows);

  return {
    rowsText: JSON.stringify(rows, null, 2),
    binding,
  };
}

function extractRowsFromChart(chart: ReportChart): DataRow[] {
  if (chart.chart_type === "table") {
    return (chart.table_data?.rows || []) as DataRow[];
  }

  const option = (chart.echarts || {}) as {
    xAxis?: { data?: Scalar[] };
    series?: Array<{ name?: string; data?: Scalar[] }>;
  };

  const xAxisData = option.xAxis?.data || [];
  const series = option.series || [];

  const rows: DataRow[] = [];

  series.forEach((seriesItem, seriesIndex) => {
    const seriesName = seriesItem.name || `series_${seriesIndex + 1}`;
    const points = seriesItem.data || [];

    xAxisData.forEach((xValue, pointIndex) => {
      rows.push({
        x: xValue,
        series: seriesName,
        value: normalizeScalar(points[pointIndex]),
      });
    });
  });

  return rows;
}

function inferBinding(rows: DataRow[]): ChartBinding {
  const fields = rows.length ? Object.keys(rows[0]) : [];
  const fallback = fields[0] || "x";

  return {
    xField: fields.find((field) => field.toLowerCase().includes("x")) || fallback,
    seriesField: fields.find((field) => field.toLowerCase().includes("series")) || fields[1] || fallback,
    valueField: fields.find((field) => field.toLowerCase().includes("value")) || fields[2] || fallback,
    chartType: "line",
  };
}

function parseRowsText(input: string): DataRow[] {
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => {
      const row: DataRow = {};
      Object.entries(item as Record<string, unknown>).forEach(([key, value]) => {
        row[key] = normalizeScalar(value);
      });
      return row;
    });
  } catch {
    return [];
  }
}

function getRowFields(rows: DataRow[]): string[] {
  const allFields = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => allFields.add(key));
  });
  return Array.from(allFields);
}

function normalizeScalar(input: unknown): Scalar {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === "number") {
    return input;
  }

  if (typeof input === "string") {
    const numeric = Number(input);
    if (!Number.isNaN(numeric) && input.trim() !== "") {
      return numeric;
    }
    return input;
  }

  return String(input);
}

function buildOptionFromRows(rows: DataRow[], binding: ChartBinding, chart: ReportChart): Record<string, unknown> {
  const xValues: string[] = [];
  const xSet = new Set<string>();
  const seriesNames: string[] = [];
  const seriesSet = new Set<string>();

  rows.forEach((row) => {
    const x = String(row[binding.xField] ?? "");
    const series = String(row[binding.seriesField] ?? "");

    if (!xSet.has(x)) {
      xSet.add(x);
      xValues.push(x);
    }

    if (!seriesSet.has(series)) {
      seriesSet.add(series);
      seriesNames.push(series);
    }
  });

  const series = seriesNames.map((name) => {
    const points = xValues.map((x) => {
      const matched = rows.find(
        (row) => String(row[binding.xField] ?? "") === x && String(row[binding.seriesField] ?? "") === name,
      );
      const value = matched?.[binding.valueField];
      return typeof value === "number" ? value : value === null ? null : Number(value);
    });

    return {
      name,
      type: binding.chartType,
      data: points,
      smooth: binding.chartType === "line",
      connectNulls: true,
    };
  });

  const original = (chart.echarts || {}) as Record<string, unknown>;

  return {
    ...original,
    tooltip: {
      trigger: "axis",
      ...(original.tooltip as object),
    },
    legend: {
      show: true,
      ...(original.legend as object),
    },
    xAxis: {
      type: "category",
      ...(original.xAxis as object),
      data: xValues,
    },
    yAxis: {
      type: "value",
      ...(original.yAxis as object),
    },
    series,
  };
}

function nextSectionKey(sections: ReportDetail["sections"]): string {
  const base = "section_";
  let idx = sections.length + 1;
  let key = `${base}${idx}`;

  const existing = new Set(sections.map((item) => item.section_key));
  while (existing.has(key)) {
    idx += 1;
    key = `${base}${idx}`;
  }

  return key;
}

function nextChartId(charts: ReportChart[]): string {
  const base = "chart_";
  let idx = charts.length + 1;
  let id = `${base}${idx}`;

  const existing = new Set(charts.map((item) => item.chart_id));
  while (existing.has(id)) {
    idx += 1;
    id = `${base}${idx}`;
  }

  return id;
}

function createDefaultChart(chartId: string): ReportChart {
  return {
    chart_id: chartId,
    chart_type: "line",
    title: `New Chart ${chartId}`,
    subtitle: null,
    echarts: {
      xAxis: { type: "category", data: ["2026-01", "2026-02", "2026-03"] },
      yAxis: { type: "value" },
      series: [{ name: "Series A", type: "line", data: [120, 132, 101], smooth: true }],
    },
    table_data: null,
    meta: {
      formatter: "decimal",
      metric_name: "new_metric",
    },
  };
}
