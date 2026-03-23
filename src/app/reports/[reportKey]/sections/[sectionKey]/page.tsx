"use client";

import { useParams } from "next/navigation";
import { Card, Empty, Space, Table, Tag, Typography } from "antd";
import { useSectionDetailQuery } from "@/features/reports/hooks";

export default function SectionDetailPage() {
  const { reportKey, sectionKey } = useParams<{ reportKey: string; sectionKey: string }>();
  const sectionQuery = useSectionDetailQuery(reportKey, sectionKey);

  const section = sectionQuery.data;
  const charts = section?.content_items?.charts || [];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Card title="Section 元信息">
        {section ? (
          <Space direction="vertical">
            <Typography.Text>
              section_key: <strong>{section.section_key}</strong>
            </Typography.Text>
            <Typography.Text>
              title: <strong>{section.title}</strong>
            </Typography.Text>
            <Typography.Text>
              subtitle: <strong>{section.subtitle || "-"}</strong>
            </Typography.Text>
          </Space>
        ) : (
          <Empty description="加载中或无数据" />
        )}
      </Card>

      <Card title="Charts 结构化预览">
        {charts.length ? (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {charts.map((chart) => {
              const columns =
                chart.table_data?.columns?.map((column) => ({
                  title: column.title,
                  dataIndex: column.key,
                  key: column.key,
                })) || [];

              return (
                <Card
                  key={chart.chart_id}
                  type="inner"
                  title={
                    <Space>
                      <Typography.Text strong>{chart.title}</Typography.Text>
                      <Tag>{chart.chart_type}</Tag>
                    </Space>
                  }
                >
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Typography.Text>
                      chart_id: <strong>{chart.chart_id}</strong>
                    </Typography.Text>
                    <Typography.Text>
                      subtitle: <strong>{chart.subtitle || "-"}</strong>
                    </Typography.Text>

                    {chart.chart_type === "line" ? (
                      <pre style={{ background: "#f7fafc", padding: 12, borderRadius: 10, overflowX: "auto" }}>
                        {JSON.stringify(chart.echarts || {}, null, 2)}
                      </pre>
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
          <Empty description="该 section 暂无 chart 数据" />
        )}
      </Card>
    </Space>
  );
}