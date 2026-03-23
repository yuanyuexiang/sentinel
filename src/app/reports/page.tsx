"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, Modal, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { http } from "@/lib/http";
import type { ReportListItem } from "@/features/reports/types";
import {
  useAssembleMutation,
  useDeleteReportMutation,
  usePublishMutation,
  useReportsQuery,
} from "@/features/reports/hooks";

type SnapshotMap = Record<string, number>;

export default function ReportsPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [comment, setComment] = useState("");
  const [publishingReportKey, setPublishingReportKey] = useState<string | null>(null);
  const [latestSnapshots, setLatestSnapshots] = useState<SnapshotMap>({});

  const reportsQuery = useReportsQuery();
  const assembleMutation = useAssembleMutation();
  const publishMutation = usePublishMutation();
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
        const color = status === "published" ? "green" : "blue";
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: "Published Version",
      dataIndex: "published_version",
      key: "published_version",
    },
    {
      title: "操作",
      key: "actions",
      render: (_, row) => {
        const snapshotId = latestSnapshots[row.report_key];

        return (
          <Space>
            <Link href={`/reports/${row.report_key}`}>
              <Button>查看详情</Button>
            </Link>
            <Button
              loading={assembleMutation.isPending}
              onClick={async () => {
                try {
                  const result = await assembleMutation.mutateAsync(row.report_key);
                  setLatestSnapshots((prev) => ({ ...prev, [row.report_key]: result.snapshot_id }));
                  messageApi.success(`组装成功，snapshot_id=${result.snapshot_id}`);
                } catch (error) {
                  messageApi.error(`组装失败：${http.toErrorMessage(error)}`);
                }
              }}
            >
              组装
            </Button>
            <Button
              type="primary"
              disabled={!snapshotId}
              onClick={() => setPublishingReportKey(row.report_key)}
            >
              发布
            </Button>
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

  const activeSnapshotId = publishingReportKey ? latestSnapshots[publishingReportKey] : undefined;

  return (
    <>
      {contextHolder}
      {modalContextHolder}
      <Card
        title="报告列表"
        extra={
          <Space>
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
          发布前请先组装。发布动作仅允许使用本页最近一次组装结果的 snapshot_id。
        </Typography.Paragraph>
        <Table<ReportListItem>
          rowKey="report_key"
          loading={reportsQuery.isLoading}
          dataSource={reportsQuery.data || []}
          columns={columns}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        open={Boolean(publishingReportKey)}
        title="确认发布"
        okText="确认发布"
        cancelText="取消"
        confirmLoading={publishMutation.isPending}
        onCancel={() => {
          setPublishingReportKey(null);
          setComment("");
        }}
        onOk={async () => {
          if (!publishingReportKey || !activeSnapshotId) {
            messageApi.error("发布失败：缺少 snapshot_id，请先组装");
            return;
          }

          try {
            const result = await publishMutation.mutateAsync({
              reportKey: publishingReportKey,
              snapshotId: activeSnapshotId,
              comment: comment || undefined,
            });

            messageApi.success(`发布成功，version=${result.published_version}`);
            setPublishingReportKey(null);
            setComment("");
          } catch (error) {
            messageApi.error(`发布失败：${http.toErrorMessage(error)}`);
          }
        }}
      >
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Typography.Text>
            report_key: <strong>{publishingReportKey || "-"}</strong>
          </Typography.Text>
          <Typography.Text>
            snapshot_id: <strong>{activeSnapshotId || "-"}</strong>
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