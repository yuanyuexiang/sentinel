"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Card, Descriptions, Empty, Modal, Space, Typography, message } from "antd";
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
  const orderedSections = [...(detail?.sections || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <>
      {contextHolder}
      {modalContextHolder}
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        <Card
          title="报告详情"
          extra={
            <Space>
              <Link href="/reports">
                <Button>返回列表</Button>
              </Link>
              <Link href={`/reports/${reportKey}/edit`}>
                <Button type="dashed">内容编辑</Button>
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
          {detailQuery.isLoading ? (
            <Typography.Text>加载中...</Typography.Text>
          ) : detail ? (
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="id">{detail.id || "-"}</Descriptions.Item>
              <Descriptions.Item label="report_key">{detail.report_key}</Descriptions.Item>
              <Descriptions.Item label="name">{detail.name}</Descriptions.Item>
              <Descriptions.Item label="type">{detail.type}</Descriptions.Item>
              <Descriptions.Item label="status">{detail.status}</Descriptions.Item>
              <Descriptions.Item label="updated_at">{detail.updated_at || "-"}</Descriptions.Item>
              <Descriptions.Item label="published_version">{detail.published_version ?? "-"}</Descriptions.Item>
            </Descriptions>
          ) : (
            <Empty description="暂无数据" />
          )}
        </Card>

        <Card title="报告内容预览（整页）">
          {orderedSections.length ? (
            <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
              {orderedSections.map((section) => {
                const charts = section.content_items?.charts || [];
                const sectionDomKey = `${section.chapter_key || "chapter_1"}-${section.section_key}`;

                return (
                  <Card
                    key={sectionDomKey}
                    id={`section-${sectionDomKey}`}
                    type="inner"
                    title={
                      <Space>
                        <Typography.Text strong>{section.title}</Typography.Text>
                        <Typography.Text type="secondary">({section.section_key})</Typography.Text>
                        <Typography.Text type="secondary">order: {section.order || 0}</Typography.Text>
                      </Space>
                    }
                  >
                    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                      <Typography.Text type="secondary">
                        subtitle: {section.subtitle || "-"}
                      </Typography.Text>
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

  const filteredCharts = filteredSectionQuery.data?.content_items?.charts || charts;

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

      {filteredCharts.map((chart) => {
        return (
          <Card
            key={chart.chart_id}
            type="inner"
            title={
              <Space>
                <Typography.Text strong>{chart.title}</Typography.Text>
                <Typography.Text type="secondary">({chart.chart_id})</Typography.Text>
                <Typography.Text type="secondary">{chart.chart_type}</Typography.Text>
              </Space>
            }
          >
            <Space orientation="vertical" style={{ width: "100%" }}>
              <Space size={[8, 8]} wrap>
                {typeof chart.meta?.formatter === "string" ? (
                  <Typography.Text type="secondary">formatter: {chart.meta.formatter}</Typography.Text>
                ) : null}
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
      })}
    </Space>
  );
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