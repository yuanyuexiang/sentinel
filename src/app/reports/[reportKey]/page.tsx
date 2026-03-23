"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Descriptions, Empty, Input, Modal, Space, Table, Typography, message } from "antd";
import ReactECharts from "echarts-for-react";
import {
  useAssembleMutation,
  useDeleteReportMutation,
  usePublishMutation,
  useReportDetailQuery,
} from "@/features/reports/hooks";
import { http } from "@/lib/http";

export default function ReportDetailPage() {
  const { reportKey } = useParams<{ reportKey: string }>();
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [publishOpen, setPublishOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [latestSnapshotId, setLatestSnapshotId] = useState<number | null>(null);

  const detailQuery = useReportDetailQuery(reportKey);
  const assembleMutation = useAssembleMutation();
  const publishMutation = usePublishMutation();
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
              <Button
                loading={assembleMutation.isPending}
                onClick={async () => {
                  try {
                    const result = await assembleMutation.mutateAsync(reportKey);
                    setLatestSnapshotId(result.snapshot_id);
                    messageApi.success(`组装成功，snapshot_id=${result.snapshot_id}`);
                  } catch (error) {
                    messageApi.error(`组装失败：${http.toErrorMessage(error)}`);
                  }
                }}
              >
                Assemble
              </Button>
              <Button type="primary" disabled={!latestSnapshotId} onClick={() => setPublishOpen(true)}>
                Publish
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
              <Descriptions.Item label="published_version">{detail.published_version}</Descriptions.Item>
              <Descriptions.Item label="latest_snapshot_id">{latestSnapshotId || "-"}</Descriptions.Item>
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

                return (
                  <Card
                    key={section.section_key}
                    id={`section-${section.section_key}`}
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

                      {charts.length ? (
                        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
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

                                  {chart.chart_type !== "table" && chart.echarts ? (
                                    <ReactECharts
                                      option={chart.echarts}
                                      notMerge
                                      lazyUpdate
                                      style={{ width: "100%", height: 380 }}
                                    />
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

                                  {chart.chart_type !== "table" && !chart.echarts ? (
                                    <Empty description="该图表无 echarts option 数据" />
                                  ) : null}
                                </Space>
                              </Card>
                            );
                          })}
                        </Space>
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

      <Modal
        open={publishOpen}
        title="发布确认"
        onCancel={() => {
          setPublishOpen(false);
          setComment("");
        }}
        okText="确认发布"
        cancelText="取消"
        confirmLoading={publishMutation.isPending}
        onOk={async () => {
          if (!latestSnapshotId) {
            messageApi.error("发布失败：缺少 snapshot_id，请先组装");
            return;
          }

          try {
            const result = await publishMutation.mutateAsync({
              reportKey,
              snapshotId: latestSnapshotId,
              comment: comment || undefined,
            });
            messageApi.success(`发布成功，version=${result.published_version}`);
            setPublishOpen(false);
            setComment("");
          } catch (error) {
            messageApi.error(`发布失败：${http.toErrorMessage(error)}`);
          }
        }}
      >
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Typography.Text>
            snapshot_id: <strong>{latestSnapshotId || "-"}</strong>
          </Typography.Text>
          <Input.TextArea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            placeholder="发布备注（可选）"
          />
        </Space>
      </Modal>
    </>
  );
}