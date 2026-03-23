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
  Divider,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Steps,
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
  const [currentStep, setCurrentStep] = useState(0);

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
  const editableRows = getSourceRows(selectedEditorState);
  const rowFields = getRowFields(editableRows);
  const allCharts = sections.flatMap((section) => section.content_items?.charts || []);
  const configuredCharts = allCharts.filter((chart) => isChartConfigured(chart)).length;
  const validationIssues = collectValidationIssues(draft);
  const previewOption =
    selectedChart && selectedEditorState && selectedChart.chart_type !== "table" && editableRows.length
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

  const updateSelectedSectionMeta = (next: { title?: string; subtitle?: string | null }) => {
    if (!selectedSection) {
      return;
    }

    const nextDraft = cloneReport(draft);
    const targetSection = nextDraft.sections.find((item) => item.section_key === selectedSection.section_key);
    if (!targetSection) {
      return;
    }

    if (typeof next.title === "string") {
      targetSection.title = next.title;
    }

    if (next.subtitle !== undefined) {
      targetSection.subtitle = next.subtitle;
    }

    setDraft(nextDraft);
  };

  const updateSelectedChartMeta = (next: { title?: string; chart_type?: "line" | "bar" | "table" }) => {
    if (!selectedSection || !selectedChart) {
      return;
    }

    const nextDraft = cloneReport(draft);
    const targetSection = nextDraft.sections.find((item) => item.section_key === selectedSection.section_key);
    const targetChart = targetSection?.content_items?.charts?.find((item) => item.chart_id === selectedChart.chart_id);

    if (!targetChart) {
      return;
    }

    if (typeof next.title === "string") {
      targetChart.title = next.title;
    }

    if (next.chart_type) {
      targetChart.chart_type = next.chart_type;
    }

    setDraft(nextDraft);
  };

  const applyBindingToChart = () => {
    if (!selectedSection || !selectedChart || !selectedEditorState) {
      return;
    }

    const rows = getSourceRows(selectedEditorState);
    if (!rows.length) {
      onError("请先提供可用 JSON 数据行");
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

  const goNextStep = () => {
    if (currentStep === 0) {
      if (!draft.name.trim() || !draft.type.trim()) {
        onError("请先完成基础信息（name/type）");
        return;
      }
    }

    if (currentStep === 1) {
      if (!sections.length || !allCharts.length) {
        onError("请至少创建 1 个 section 和 1 个 chart");
        return;
      }
    }

    if (currentStep === 2) {
      if (!selectedEditorState || !parseRowsText(selectedEditorState.rowsText).length) {
        onError("请先输入有效 JSON 数据行");
        return;
      }
    }

    if (currentStep === 3) {
      if (!configuredCharts) {
        onError("请至少完成一个图表绑定并应用");
        return;
      }
    }

    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const goPrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      {contextHolder}

      <Card>
        <Steps
          current={currentStep}
          onChange={(next) => {
            if (next <= currentStep) {
              setCurrentStep(next);
              return;
            }

            goNextStep();
          }}
          items={[
            {
              title: "基础信息",
              description: draft.name && draft.type ? "已完成" : "待完成",
            },
            {
              title: "结构编辑",
              description: `${sections.length} sections / ${allCharts.length} charts`,
            },
            {
              title: "数据源",
              description: selectedEditorState && parseRowsText(selectedEditorState.rowsText).length ? "已输入" : "待输入",
            },
            {
              title: "字段绑定",
              description: `${configuredCharts}/${allCharts.length || 0} 已配置`,
            },
            {
              title: "校验发布",
              description: validationIssues.length ? `${validationIssues.length} 个问题` : "可发布",
            },
          ]}
        />
      </Card>

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
          按步骤完成编辑：先定义结构，再输入数据，完成字段绑定，最后校验并发布。
        </Typography.Paragraph>

        {currentStep === 0 ? (
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
        ) : (
          <Alert
            type="info"
            showIcon
            message={`当前步骤：${
              ["基础信息", "结构编辑", "数据源", "字段绑定", "校验发布"][currentStep]
            }`}
          />
        )}
      </Card>

      {currentStep >= 1 && currentStep <= 3 ? (
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
                              rowKey="__rowKey"
                              columns={columns}
                              dataSource={(chart.table_data?.rows || []).map((row, index) => ({
                                ...row,
                                __rowKey: `${chart.chart_id}-${index}`,
                              }))}
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
            {currentStep === 1 ? (
              <Card title="结构编辑" styles={{ body: { maxHeight: 700, overflowY: "auto" } }}>
                {selectedSection ? (
                  <Space orientation="vertical" style={{ width: "100%" }}>
                    <Typography.Text strong>Section 设置</Typography.Text>
                    <Input
                      value={selectedSection.title}
                      onChange={(event) => updateSelectedSectionMeta({ title: event.target.value })}
                      placeholder="Section title"
                    />
                    <Input
                      value={selectedSection.subtitle || ""}
                      onChange={(event) => updateSelectedSectionMeta({ subtitle: event.target.value || null })}
                      placeholder="Section subtitle"
                    />

                    <Divider style={{ margin: "8px 0" }} />

                    {selectedChart ? (
                      <>
                        <Typography.Text strong>Chart 设置</Typography.Text>
                        <Input
                          value={selectedChart.title}
                          onChange={(event) => updateSelectedChartMeta({ title: event.target.value })}
                          placeholder="Chart title"
                        />
                        <Select
                          value={normalizeChartType(selectedChart.chart_type)}
                          onChange={(value: "line" | "bar" | "table") => updateSelectedChartMeta({ chart_type: value })}
                          options={[
                            { label: "line", value: "line" },
                            { label: "bar", value: "bar" },
                            { label: "table", value: "table" },
                          ]}
                        />
                      </>
                    ) : (
                      <Alert type="info" showIcon message="请在结构树选择一个 chart 进行编辑" />
                    )}

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
                  </Space>
                ) : (
                  <Empty description="请先选择一个 section" />
                )}
              </Card>
            ) : null}

            {currentStep === 2 ? (
              <Card title="数据源输入" styles={{ body: { maxHeight: 700, overflowY: "auto" } }}>
                {selectedChart && selectedEditorState ? (
                  <Space orientation="vertical" style={{ width: "100%" }}>
                    <Alert type="info" showIcon message="Excel 上传已暂时关闭，请直接输入 JSON 行数据。" />

                    <Input.TextArea
                      value={selectedEditorState.rowsText}
                      onChange={(event) => updateSelectedEditorState({ rowsText: event.target.value })}
                      rows={10}
                      placeholder='示例: [{"x":"2024-01","series":"Platform","value":123}]'
                    />

                    <Card size="small" title="数据样本（当前 JSON）">
                      {editableRows.length ? (
                        <Table
                          size="small"
                          pagination={false}
                          scroll={{ x: true, y: 180 }}
                          rowKey="__sampleKey"
                          columns={rowFields.map((field) => ({
                            title: field,
                            dataIndex: field,
                            key: field,
                            width: 120,
                          }))}
                          dataSource={editableRows.slice(0, 20).map((row, index) => ({
                            ...row,
                            __sampleKey: `sample-${index}`,
                          }))}
                        />
                      ) : (
                        <Alert type="info" showIcon message="当前没有可用数据样本，请先输入有效 JSON。" />
                      )}
                    </Card>
                  </Space>
                ) : (
                  <Empty description="请先在结构树选择一个 chart" />
                )}
              </Card>
            ) : null}

            {currentStep === 3 ? (
              <Card title="字段绑定与预览" styles={{ body: { maxHeight: 700, overflowY: "auto" } }}>
                {selectedChart && selectedEditorState ? (
                  <Space orientation="vertical" style={{ width: "100%" }}>
                    <Typography.Text strong>{selectedChart.title}</Typography.Text>
                    <Typography.Text type="secondary">chart_id: {selectedChart.chart_id}</Typography.Text>

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
                      rows={8}
                      placeholder='可选：手动覆盖数据 JSON，如 [{"x":"2024-01","series":"Platform","value":123}]'
                    />

                    <Button type="primary" onClick={applyBindingToChart}>
                      应用到当前图表
                    </Button>

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
            ) : null}
          </Col>
        </Row>
      ) : null}

      {currentStep === 4 ? (
        <Card title="校验与发布">
          <Space orientation="vertical" style={{ width: "100%" }}>
            <Typography.Text>
              结构统计：{sections.length} sections / {allCharts.length} charts / {configuredCharts} 已配置
            </Typography.Text>

            {validationIssues.length ? (
              <Alert
                type="error"
                showIcon
                message="发现阻断问题，请先修复"
                description={
                  <Space orientation="vertical" size={4} style={{ width: "100%" }}>
                    {validationIssues.map((issue) => (
                      <Typography.Text key={issue} type="danger">
                        - {issue}
                      </Typography.Text>
                    ))}
                  </Space>
                }
              />
            ) : (
              <Alert type="success" showIcon message="校验通过，可保存草稿并进行发布流程。" />
            )}

            <Space>
              <Button type="primary" loading={updateMutation.isPending} onClick={saveDraft}>
                保存草稿
              </Button>
              <Link href={`/reports/${reportKey}`}>
                <Button>前往预览页面</Button>
              </Link>
            </Space>
          </Space>
        </Card>
      ) : null}

      <Card>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Button onClick={goPrevStep} disabled={currentStep === 0}>
            上一步
          </Button>
          <Button type="primary" onClick={goNextStep} disabled={currentStep === 4}>
            下一步
          </Button>
        </Space>
      </Card>
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

function getSourceRows(editorState: ChartEditorState | undefined): DataRow[] {
  if (!editorState) {
    return [];
  }

  return parseRowsText(editorState.rowsText);
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

function isChartConfigured(chart: ReportChart): boolean {
  if (chart.chart_type === "table") {
    return Boolean(chart.table_data?.rows?.length);
  }

  const option = (chart.echarts || {}) as { series?: unknown[] };
  return Array.isArray(option.series) && option.series.length > 0;
}

function normalizeChartType(input: string): "line" | "bar" | "table" {
  if (input === "bar" || input === "table") {
    return input;
  }

  return "line";
}

function collectValidationIssues(report: ReportDetail): string[] {
  const issues: string[] = [];

  if (!report.name.trim()) {
    issues.push("报告名称不能为空");
  }

  if (!report.type.trim()) {
    issues.push("报告类型不能为空");
  }

  const sections = report.sections || [];
  if (!sections.length) {
    issues.push("至少需要 1 个 section");
    return issues;
  }

  sections.forEach((section) => {
    const charts = section.content_items?.charts || [];
    if (!charts.length) {
      issues.push(`Section ${section.section_key} 没有 chart`);
      return;
    }

    charts.forEach((chart) => {
      if (!isChartConfigured(chart)) {
        issues.push(`Chart ${chart.chart_id} 尚未完成配置`);
      }
    });
  });

  return issues;
}
