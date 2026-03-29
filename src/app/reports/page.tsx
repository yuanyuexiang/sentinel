"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Modal, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { http } from "@/lib/http";
import type { ReportListItem } from "@/features/reports/types";
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

  const columns: ColumnsType<ReportListItem> = [
    {
      title: "Report Key",
      dataIndex: "report_key",
      key: "report_key",
    },
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const color = status === "active" ? "green" : "blue";
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: "Updated At",
      key: "updated_at",
      render: (_, row) => formatDateTime(row.updated_at),
    },
    {
      title: "操作",
      key: "actions",
      render: (_, row) => {
        return (
          <Space>
            <Link href={`/reports/${row.report_key}`}>
              <Button>查看详情</Button>
            </Link>
            <Button
              onClick={() => router.push(`/reports/${row.report_key}/edit`)}
            >
              内容编辑
            </Button>
            <Button
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
        );
      },
    },
  ];

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
        <Table<ReportListItem>
          rowKey="report_key"
          loading={reportsQuery.isLoading}
          dataSource={reportsQuery.data || []}
          columns={columns}
          pagination={{ pageSize: 10 }}
        />
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