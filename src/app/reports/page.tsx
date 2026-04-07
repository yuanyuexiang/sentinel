"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Modal, Space, Tag, Typography, message } from "antd";
import { http } from "@/lib/http";
import {
  useDeleteReportMutation,
  useReportsQuery,
} from "@/features/reports/hooks";

export default function ReportsPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  const reportsQuery = useReportsQuery();
  const deleteMutation = useDeleteReportMutation();
  const reports = reportsQuery.data || [];

  return (
    <>
      {contextHolder}
      {modalContextHolder}
      <Card
        title="报告列表"
        extra={
          <Space>
            <Link href="/reports/upload">
              <Button type="dashed">上传模板</Button>
            </Link>
            <Link href="/reports/new">
              <Button>新建 Report</Button>
            </Link>
            <Button onClick={() => reportsQuery.refetch()} loading={reportsQuery.isFetching}>
              刷新
            </Button>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          当前为保存即生效流程，进入内容编辑后可直接保存报告结构。
        </Typography.Paragraph>

        {reportsQuery.isLoading ? (
          <Typography.Text type="secondary">加载中...</Typography.Text>
        ) : reports.length === 0 ? (
          <Typography.Text type="secondary">暂无报告</Typography.Text>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {reports.map((row) => {
              const statusColor = row.status === "active" ? "green" : "blue";

              return (
                <Card
                  key={row.report_key}
                  size="small"
                  style={{ borderRadius: 12 }}
                  title={
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <Typography.Text strong style={{ color: "#0f172a" }}>
                        {row.name}
                      </Typography.Text>
                      <Tag color={statusColor}>{row.status}</Tag>
                    </div>
                  }
                >
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    <Typography.Text type="secondary">Report Key: {row.report_key}</Typography.Text>
                    <Typography.Text type="secondary">类型: {row.type}</Typography.Text>
                    <Typography.Text type="secondary">Updated: {formatDateTime(row.updated_at)}</Typography.Text>

                    <Space wrap>
                      <Link href={`/reports/${row.report_key}`}>
                        <Button size="small">查看详情</Button>
                      </Link>
                      <Button
                        size="small"
                        onClick={() => router.push(`/reports/${row.report_key}/edit`)}
                      >
                        内容编辑
                      </Button>
                      <Button
                        size="small"
                        danger
                        onClick={() => {
                          modalApi.confirm({
                            title: "确认删除报告",
                            content: `删除 ${row.report_key} 后不可恢复，确定继续吗？`,
                            okText: "确认删除",
                            cancelText: "取消",
                            okButtonProps: {
                              danger: true,
                              loading: deleteMutation.isPending,
                            },
                            onOk: async () => {
                              try {
                                await deleteMutation.mutateAsync(row.report_key);
                                messageApi.success("删除成功");
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
                  </Space>
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", { hour12: false });
}