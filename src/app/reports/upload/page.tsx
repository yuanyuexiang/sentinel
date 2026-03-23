"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Card, Form, Input, Progress, Space, Typography, Upload, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { UploadOutlined } from "@ant-design/icons";
import { http } from "@/lib/http";
import { useUploadExcelMutation } from "@/features/reports/hooks";

const schema = z.object({
  reportKey: z.string().trim().optional(),
  file: z
    .instanceof(File, { message: "请上传 .xlsx 文件" })
    .refine((file) => file.name.toLowerCase().endsWith(".xlsx"), { message: "仅支持 .xlsx 文件" }),
});

type FormValues = z.infer<typeof schema>;

export default function ReportUploadPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [progress, setProgress] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | undefined>();
  const [lastResult, setLastResult] = useState<{
    reportKey: string;
    parsedCharts: number;
    parsedPoints: number;
  } | null>(null);

  const router = useRouter();
  const uploadMutation = useUploadExcelMutation();

  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const fileList: UploadFile[] = (() => {
    if (!selectedFile) {
      return [];
    }

    return [
      {
        uid: selectedFile.name,
        name: selectedFile.name,
        status: "done",
      },
    ];
  })();

  return (
    <>
      {contextHolder}
      <Card title="上传 Excel" style={{ maxWidth: 760 }}>
        <Form layout="vertical" onFinish={handleSubmit(async (values) => {
          setProgress(0);

          try {
            const result = await uploadMutation.mutateAsync({
              file: values.file,
              reportKey: values.reportKey || undefined,
              onUploadProgress: (event) => {
                if (event.total) {
                  setProgress(Math.round((event.loaded / event.total) * 100));
                }
              },
            });

            setLastResult({
              reportKey: result.report_key,
              parsedCharts: result.parsed_charts,
              parsedPoints: result.parsed_points,
            });

            messageApi.success("上传成功，正在跳转到报告详情页");
            router.push(`/reports/${result.report_key}`);
          } catch (error) {
            messageApi.error(`上传失败：${http.toErrorMessage(error)}`);
          }
        })}>
          <Form.Item label="Report Key（可选）" validateStatus={errors.reportKey ? "error" : undefined} help={errors.reportKey?.message}>
            <Input placeholder="data-analytics" {...register("reportKey")} />
          </Form.Item>

          <Form.Item label="Excel 文件（.xlsx）" validateStatus={errors.file ? "error" : undefined} help={errors.file?.message}>
            <Upload
              beforeUpload={(file) => {
                setValue("file", file as unknown as File, { shouldValidate: true });
                setSelectedFile(file as unknown as File);
                return false;
              }}
              maxCount={1}
              fileList={fileList}
              accept=".xlsx"
              onRemove={() => {
                setValue("file", undefined as unknown as File, { shouldValidate: true });
                setSelectedFile(undefined);
                return true;
              }}
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>

          {uploadMutation.isPending ? <Progress percent={progress} status="active" /> : null}

          <Space style={{ marginTop: 12 }}>
            <Button type="primary" htmlType="submit" loading={uploadMutation.isPending}>
              开始上传
            </Button>
          </Space>
        </Form>

        {lastResult ? (
          <Card size="small" style={{ marginTop: 16 }}>
            <Typography.Text>
              report_key: <strong>{lastResult.reportKey}</strong>
            </Typography.Text>
            <br />
            <Typography.Text>
              parsed_charts: <strong>{lastResult.parsedCharts}</strong>
            </Typography.Text>
            <br />
            <Typography.Text>
              parsed_points: <strong>{lastResult.parsedPoints}</strong>
            </Typography.Text>
          </Card>
        ) : null}
      </Card>
    </>
  );
}