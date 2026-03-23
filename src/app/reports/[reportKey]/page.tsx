"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button, Card, Descriptions, Empty, Input, List, Modal, Space, Typography, message } from "antd";
import { useAssembleMutation, usePublishMutation, useReportDetailQuery } from "@/features/reports/hooks";
import { http } from "@/lib/http";

export default function ReportDetailPage() {
  const { reportKey } = useParams<{ reportKey: string }>();
  const [messageApi, contextHolder] = message.useMessage();
  const [publishOpen, setPublishOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [latestSnapshotId, setLatestSnapshotId] = useState<number | null>(null);

  const detailQuery = useReportDetailQuery(reportKey);
  const assembleMutation = useAssembleMutation();
  const publishMutation = usePublishMutation();

  const detail = detailQuery.data;

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Card
          title="报告详情"
          extra={
            <Space>
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

        <Card title="Sections">
          {detail?.sections?.length ? (
            <List
              itemLayout="horizontal"
              dataSource={detail.sections}
              renderItem={(section) => (
                <List.Item
                  actions={[
                    <Link key="view" href={`/reports/${reportKey}/sections/${section.section_key}`}>
                      查看 Section
                    </Link>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Typography.Text strong>{section.title}</Typography.Text>
                        <Typography.Text type="secondary">({section.section_key})</Typography.Text>
                      </Space>
                    }
                    description={`charts: ${section.content_items?.charts?.length || 0}`}
                  />
                </List.Item>
              )}
            />
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
        <Space direction="vertical" style={{ width: "100%" }}>
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