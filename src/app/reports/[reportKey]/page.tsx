"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Card, Col, Empty, Modal, Row, Space, Typography, message } from "antd";
import { Select } from "antd";
import { ChartWithFilters } from "@/features/reports/chartWithFilters";
import {
  useDeleteReportMutation,
  useReportDetailQuery,
  useSectionDetailQuery,
} from "@/features/reports/hooks";
import type { ReportChart, ReportSection } from "@/features/reports/types";
import { http } from "@/lib/http";

const ALL_FILTER = "All";

export default function ReportDetailPage() {
  const { reportKey } = useParams<{ reportKey: string }>();
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  const detailQuery = useReportDetailQuery(reportKey);
  const deleteMutation = useDeleteReportMutation();

  const detail = detailQuery.data;
  const chapterOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    const chapters = [...(detail?.chapters || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    chapters.forEach((chapter, index) => {
      map.set(chapter.chapter_key, index);
    });
    return map;
  }, [detail?.chapters]);

  const chapterMetaMap = useMemo(() => {
    const map = new Map<string, { title: string; order: number }>();
    (detail?.chapters || []).forEach((chapter, index) => {
      map.set(chapter.chapter_key, {
        title: chapter.title || chapter.chapter_key,
        order: chapter.order || index + 1,
      });
    });
    return map;
  }, [detail?.chapters]);

  const orderedSections = useMemo(() => {
    return [...(detail?.sections || [])].sort((a, b) => {
      const chapterA = a.chapter_key || "chapter_1";
      const chapterB = b.chapter_key || "chapter_1";

      const chapterOrderA = chapterOrderMap.get(chapterA) ?? Number.MAX_SAFE_INTEGER;
      const chapterOrderB = chapterOrderMap.get(chapterB) ?? Number.MAX_SAFE_INTEGER;
      if (chapterOrderA !== chapterOrderB) {
        return chapterOrderA - chapterOrderB;
      }

      const sectionOrderA = a.order || 0;
      const sectionOrderB = b.order || 0;
      if (sectionOrderA !== sectionOrderB) {
        return sectionOrderA - sectionOrderB;
      }

      return (a.section_key || "").localeCompare(b.section_key || "");
    });
  }, [chapterOrderMap, detail?.sections]);

  const chapterGroups = useMemo(() => {
    const groups = new Map<string, ReportSection[]>();

    orderedSections.forEach((section) => {
      const chapterKey = section.chapter_key || "chapter_1";
      if (!groups.has(chapterKey)) {
        groups.set(chapterKey, []);
      }
      groups.get(chapterKey)?.push(section);
    });

    return Array.from(groups.entries()).map(([chapterKey, sections]) => {
      const chapterMeta = chapterMetaMap.get(chapterKey);
      return {
        chapterKey,
        chapterTitle: chapterMeta?.title || chapterKey,
        chapterOrder: chapterMeta?.order || Number.MAX_SAFE_INTEGER,
        sections,
      };
    });
  }, [chapterMetaMap, orderedSections]);

  return (
    <>
      {contextHolder}
      {modalContextHolder}
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        <Card
          title={
            <Space>
              <Typography.Text strong>报告内容预览（整页）</Typography.Text>
              {detail?.name ? <Typography.Text type="secondary">{detail.name}</Typography.Text> : null}
            </Space>
          }
          extra={
            <Space>
              <Link href={`/reports/${reportKey}/edit`}>
                <Button type="dashed">编辑</Button>
              </Link>
              <Button
                danger
                onClick={() => {
                  modalApi.confirm({
                    title: "确认删除报告",
                    content: `删除 ${reportKey} 后不可恢复，确定继续吗？`,
                    okText: "确认删除",
                    cancelText: "取消",
                    okButtonProps: {
                      danger: true,
                      loading: deleteMutation.isPending,
                    },
                    onOk: async () => {
                      try {
                        await deleteMutation.mutateAsync(reportKey);
                        messageApi.success("删除成功");
                        router.push("/reports");
                      } catch (error) {
                        messageApi.error(`删除失败：${http.toErrorMessage(error)}`);
                      }
                    },
                  });
                }}
              >
                删除
              </Button>
            </Space>
          }
        >
          {chapterGroups.length ? (
            <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
              {chapterGroups.map((group) => (
                <Card
                  key={group.chapterKey}
                  type="inner"
                  title={
                    <Typography.Text strong>
                      {group.chapterTitle}
                    </Typography.Text>
                  }
                >
                  <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                    {group.sections.map((section) => {
                      const charts = section.content_items?.charts || [];
                      const sectionDomKey = `${group.chapterKey}-${section.section_key}`;

                      return (
                        <Card
                          key={sectionDomKey}
                          id={`section-${sectionDomKey}`}
                          type="inner"
                          title={
                            <Space>
                              <Typography.Text strong>{section.title}</Typography.Text>
                            </Space>
                          }
                        >
                          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                            <Typography.Paragraph style={{ margin: 0 }}>
                              {section.content || "(无描述文本)"}
                            </Typography.Paragraph>

                            {charts.length ? (
                              <SectionCharts reportKey={reportKey} section={section} />
                            ) : (
                              <Empty description="该 section 暂无 charts" />
                            )}
                          </Space>
                        </Card>
                      );
                    })}
                  </Space>
                </Card>
              ))}
            </Space>
          ) : (
            <Empty description="该报告暂无 section" />
          )}
        </Card>
      </Space>
    </>
  );
}

function SectionCharts({ reportKey, section }: { reportKey: string; section: ReportSection }) {
  const charts = useMemo(() => section.content_items?.charts || [], [section.content_items?.charts]);
  const filterModel = useMemo(() => buildGlobalFilterModel(charts), [charts]);
  const [filter1, setFilter1] = useState<string>(filterModel.filter1Options[0] || ALL_FILTER);
  const filter2Options = useMemo(() => {
    const key = filterModel.filter1Options.includes(filter1) ? filter1 : ALL_FILTER;
    return filterModel.filter2ByFilter1[key] || [ALL_FILTER];
  }, [filter1, filterModel]);
  const [filter2, setFilter2] = useState<string>(ALL_FILTER);
  const activeFilter2 = filter2Options.includes(filter2) ? filter2 : filter2Options[0] || ALL_FILTER;

  const filteredSectionQuery = useSectionDetailQuery(
    reportKey,
    section.chapter_key || "chapter_1",
    section.section_key,
    {
    filter1,
    filter2: activeFilter2,
    },
  );

  const filteredChartsRaw = filteredSectionQuery.data?.content_items?.charts || charts;
  const filteredCharts = useMemo(
    () => mergeChartPresentation(filteredChartsRaw, charts),
    [filteredChartsRaw, charts],
  );
  const lineCharts = filteredCharts.filter((chart) => chart.chart_type !== "table");
  const tableCharts = filteredCharts.filter((chart) => chart.chart_type === "table");

  const renderChartCard = (chart: ReportChart) => (
    <Card
      key={chart.chart_id}
      type="inner"
      title={
        <Space>
          <Typography.Text strong>{chart.title}</Typography.Text>
          <Typography.Text type="secondary">{chart.chart_type}</Typography.Text>
        </Space>
      }
    >
      <Space orientation="vertical" style={{ width: "100%" }}>
        <Space size={[8, 8]} wrap>
          {typeof chart.meta?.metric_name === "string" ? (
            <Typography.Text type="secondary">metric: {chart.meta.metric_name}</Typography.Text>
          ) : null}
        </Space>

        <ChartWithFilters
          chart={chart}
          height={380}
        />
      </Space>
    </Card>
  );

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      {filterModel.hasFilterData ? (
        <Space wrap>
          <Typography.Text type="secondary">filter1</Typography.Text>
          <Select
            value={filter1}
            style={{ minWidth: 180 }}
            onChange={(value) => {
              setFilter1(value);
              setFilter2(ALL_FILTER);
            }}
            options={filterModel.filter1Options.map((item) => ({ label: item, value: item }))}
          />
          <Typography.Text type="secondary">filter2</Typography.Text>
          <Select
            value={activeFilter2}
            style={{ minWidth: 180 }}
            onChange={setFilter2}
            options={filter2Options.map((item) => ({ label: item, value: item }))}
          />
          <Button
            size="small"
            onClick={() => {
              setFilter1(ALL_FILTER);
              setFilter2(ALL_FILTER);
            }}
          >
            重置筛选
          </Button>
        </Space>
      ) : (
        <Typography.Text type="secondary">当前 section 无可筛选字段（filter1/filter2）。</Typography.Text>
      )}

      {lineCharts.length ? (
        <Row gutter={[16, 16]}>
          {lineCharts.map((chart) => (
            <Col key={chart.chart_id} xs={24} md={12}>
              {renderChartCard(chart)}
            </Col>
          ))}
        </Row>
      ) : null}

      {tableCharts.map((chart) => renderChartCard(chart))}
    </Space>
  );
}

function mergeChartPresentation(nextCharts: ReportChart[], fallbackCharts: ReportChart[]): ReportChart[] {
  const fallbackById = new Map(fallbackCharts.map((chart) => [chart.chart_id, chart]));

  return nextCharts.map((chart) => {
    if (chart.chart_type !== "table") {
      return chart;
    }

    const fallback = fallbackById.get(chart.chart_id);
    const nextTable = chart.table_data;
    const fallbackTable = fallback?.table_data;

    if (!nextTable || !fallbackTable) {
      return chart;
    }

    const hasPresentation = Boolean(nextTable.presentation);
    if (hasPresentation) {
      return chart;
    }

    return {
      ...chart,
      table_data: {
        ...fallbackTable,
        ...nextTable,
        presentation: fallbackTable.presentation,
      },
    };
  });
}

function buildGlobalFilterModel(charts: ReportChart[]) {
  const filter1Set = new Set<string>([ALL_FILTER]);
  const filter2AllSet = new Set<string>([ALL_FILTER]);
  const pairs = new Map<string, Set<string>>();
  let hasFilterData = false;

  charts.forEach((chart) => {
    const meta = (chart.meta || {}) as {
      filters?: { filter1?: unknown; filter2?: unknown };
      source_rows?: unknown;
    };

    const f1 = Array.isArray(meta.filters?.filter1) ? meta.filters?.filter1 : [];
    const f2 = Array.isArray(meta.filters?.filter2) ? meta.filters?.filter2 : [];

    f1.forEach((item) => {
      const v = toText(item);
      if (v) {
        filter1Set.add(v);
        hasFilterData = true;
      }
    });
    f2.forEach((item) => {
      const v = toText(item);
      if (v) {
        filter2AllSet.add(v);
        hasFilterData = true;
      }
    });

    const rows = Array.isArray(meta.source_rows) ? (meta.source_rows as Array<Record<string, unknown>>) : [];
    rows.forEach((row) => {
      const left = toText(row.filter1) || ALL_FILTER;
      const right = toText(row.filter2) || ALL_FILTER;
      hasFilterData = hasFilterData || Boolean(toText(row.filter1) || toText(row.filter2));
      filter1Set.add(left);
      filter2AllSet.add(right);
      if (!pairs.has(left)) {
        pairs.set(left, new Set<string>([ALL_FILTER]));
      }
      pairs.get(left)?.add(right);
    });
  });

  const filter1Options = Array.from(filter1Set);
  const allFilter2 = Array.from(filter2AllSet);
  const filter2ByFilter1: Record<string, string[]> = {};

  filter2ByFilter1[ALL_FILTER] = allFilter2;
  filter1Options.forEach((f1) => {
    if (f1 === ALL_FILTER) {
      return;
    }
    filter2ByFilter1[f1] = Array.from(pairs.get(f1) || new Set<string>([ALL_FILTER]));
  });

  return {
    hasFilterData,
    filter1Options,
    filter2ByFilter1,
  };
}

function toText(input: unknown): string {
  if (input === null || input === undefined) {
    return "";
  }
  return String(input).trim();
}