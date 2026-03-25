"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Form, Input, Select, Space, Typography, message } from "antd";
import { useCreateReportMutation } from "@/features/reports/hooks";
import { http } from "@/lib/http";

type CreateReportFormValues = {
  report_key: string;
  name: string;
  type: string;
  status: string;
};

export default function NewReportPage() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<CreateReportFormValues>();

  const createMutation = useCreateReportMutation();

  return (
    <>
      {contextHolder}
      <Card
        title="新建 Report"
        extra={
          <Link href="/reports">
            <Button>返回列表</Button>
          </Link>
        }
        style={{ maxWidth: 840 }}
      >
        <Typography.Paragraph type="secondary">
          创建后会自动进入“内容编辑”页面，你可以继续新增 section/chart 并配置图表绑定。
        </Typography.Paragraph>

        <Form
          form={form}
          layout="vertical"
          initialValues={{ type: "analytics", status: "active" }}
          onFinish={async (values) => {
            try {
              const data = await createMutation.mutateAsync({
                report_key: values.report_key,
                name: values.name,
                type: values.type,
                status: values.status,
                sections: [],
              });
              messageApi.success("创建成功，正在进入内容编辑页");
              router.push(`/reports/${data.report_key}/edit`);
            } catch (error) {
              messageApi.error(`创建失败：${http.toErrorMessage(error)}`);
            }
          }}
        >
          <Form.Item
            label="report_key"
            name="report_key"
            rules={[{ required: true, message: "请输入 report_key" }]}
          >
            <Input placeholder="例如: data-analytics-v2" />
          </Form.Item>

          <Form.Item label="name" name="name" rules={[{ required: true, message: "请输入名称" }]}>
            <Input placeholder="Report Name" />
          </Form.Item>

          <Form.Item label="type" name="type" rules={[{ required: true, message: "请输入类型" }]}>
            <Input placeholder="analytics" />
          </Form.Item>

          <Form.Item label="status" name="status" rules={[{ required: true, message: "请选择状态" }]}>
            <Select
              options={[
                { label: "draft", value: "draft" },
                { label: "active", value: "active" },
              ]}
            />
          </Form.Item>

          <Space>
            <Button htmlType="button" onClick={() => form.resetFields()}>
              重置
            </Button>
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
              创建并进入内容编辑
            </Button>
          </Space>
        </Form>
      </Card>
    </>
  );
}
