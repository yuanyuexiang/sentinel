"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Progress,
  Radio,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload/interface";
import { UploadOutlined } from "@ant-design/icons";
import { http } from "@/lib/http";
import { useUploadExcelMutation, useUploadFolderMutation } from "@/features/reports/hooks";
import type { UploadFolderFileResult } from "@/features/reports/types";

const schema = z.object({
  reportKey: z.string().trim().optional(),
  file: z
    .instanceof(File, { message: "请上传 .xlsx 文件" })
    .refine((file) => file.name.toLowerCase().endsWith(".xlsx"), { message: "仅支持 .xlsx 文件" }),
});

type FormValues = z.infer<typeof schema>;

type FolderFormValues = {
  reportKey: string;
  reportName: string;
  reportType: "Deals" | "Facilities" | "Tools";
  mode: "replace" | "append";
};

export default function ReportUploadPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [progress, setProgress] = useState<number>(0);
  const [folderProgress, setFolderProgress] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | undefined>();
  const [selectedFolderFiles, setSelectedFolderFiles] = useState<File[]>([]);
  const [lastResult, setLastResult] = useState<{
    reportKey: string;
    parsedCharts: number;
    parsedPoints: number;
  } | null>(null);
  const [lastFolderResult, setLastFolderResult] = useState<{
    reportKey: string;
    totalFiles: number;
    succeededFiles: number;
    failedFiles: number;
    files: UploadFolderFileResult[];
  } | null>(null);

  const router = useRouter();
  const uploadMutation = useUploadExcelMutation();
  const uploadFolderMutation = useUploadFolderMutation();
  const [folderForm] = Form.useForm<FolderFormValues>();

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

  const folderFileList: UploadFile[] = selectedFolderFiles.map((file, index) => ({
    uid: `${file.name}-${index}`,
    name: file.webkitRelativePath || file.name,
    status: "done",
  }));

  const folderColumns: ColumnsType<UploadFolderFileResult> = [
    {
      title: "文件",
      dataIndex: "source_file",
      key: "source_file",
      width: 260,
    },
    {
      title: "chapter",
      dataIndex: "chapter_key",
      key: "chapter_key",
      render: (value?: string | null) => value || "-",
    },
    {
      title: "section",
      dataIndex: "section_key",
      key: "section_key",
      render: (value?: string | null) => value || "-",
    },
    {
      title: "charts",
      dataIndex: "parsed_charts",
      key: "parsed_charts",
    },
    {
      title: "status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const ok = status === "success";
        return <Tag color={ok ? "green" : "red"}>{status}</Tag>;
      },
    },
    {
      title: "detail",
      dataIndex: "detail",
      key: "detail",
      render: (value?: string | null) => value || "-",
    },
  ];

  return (
    <>
      {contextHolder}
      <Card title="上传模板" style={{ maxWidth: 980 }}>
        <Tabs
          items={[
            {
              key: "single",
              label: "单文件上传",
              children: (
                <Form
                  layout="vertical"
                  onFinish={handleSubmit(async (values) => {
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
                  })}
                >
                  <Form.Item
                    label="Report Key（可选）"
                    validateStatus={errors.reportKey ? "error" : undefined}
                    help={errors.reportKey?.message}
                  >
                    <Input placeholder="data-analytics" {...register("reportKey")} />
                  </Form.Item>

                  <Form.Item
                    label="Excel 文件（.xlsx）"
                    validateStatus={errors.file ? "error" : undefined}
                    help={errors.file?.message}
                  >
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
                </Form>
              ),
            },
            {
              key: "folder",
              label: "文件夹上传",
              children: (
                <>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    title="建议文件命名为 chapterN_sectionM.xlsx（例如 chapter2_section4.xlsx），后端会自动映射章节。"
                  />

                  <Form
                    form={folderForm}
                    layout="vertical"
                    initialValues={{ reportKey: "", reportName: "", reportType: "Deals", mode: "replace" }}
                    onFinish={async (values) => {
                      if (!selectedFolderFiles.length) {
                        messageApi.error("请先选择文件夹");
                        return;
                      }

                      const nonXlsx = selectedFolderFiles.filter(
                        (file) => !file.name.toLowerCase().endsWith(".xlsx"),
                      );
                      if (nonXlsx.length) {
                        messageApi.error("文件夹中包含非 .xlsx 文件，请清理后重试");
                        return;
                      }

                      setFolderProgress(0);

                      try {
                        const normalizedReportKey = values.reportKey.trim();
                        const normalizedReportName = values.reportName.trim();

                        const result = await uploadFolderMutation.mutateAsync({
                          files: selectedFolderFiles,
                          reportKey: normalizedReportKey,
                          reportName: normalizedReportName,
                          reportType: values.reportType,
                          mode: values.mode,
                          onUploadProgress: (event) => {
                            if (event.total) {
                              setFolderProgress(Math.round((event.loaded / event.total) * 100));
                            }
                          },
                        });

                        setLastFolderResult({
                          reportKey: result.report_key,
                          totalFiles: result.total_files,
                          succeededFiles: result.succeeded_files,
                          failedFiles: result.failed_files,
                          files: result.files,
                        });

                        if (result.failed_files > 0) {
                          messageApi.warning(
                            `上传完成：成功 ${result.succeeded_files}，失败 ${result.failed_files}`,
                          );
                        } else {
                          messageApi.success(`上传成功，共 ${result.succeeded_files} 个文件`);
                        }
                      } catch (error) {
                        messageApi.error(`文件夹上传失败：${http.toErrorMessage(error)}`);
                      }
                    }}
                  >
                    <Form.Item
                      label="Report Key"
                      name="reportKey"
                      rules={[
                        { required: true, message: "请填写 Report Key" },
                        {
                          validator: async (_, value: string | undefined) => {
                            if (!value || value.trim().length === 0) {
                              throw new Error("请填写 Report Key");
                            }
                          },
                        },
                      ]}
                    >
                      <Input placeholder="report20260327" />
                    </Form.Item>

                    <Form.Item
                      label="Report Name"
                      name="reportName"
                      rules={[
                        { required: true, message: "请填写 Report Name" },
                        {
                          validator: async (_, value: string | undefined) => {
                            if (!value || value.trim().length === 0) {
                              throw new Error("请填写 Report Name");
                            }
                          },
                        },
                      ]}
                    >
                      <Input placeholder="2026 Q1 Loan Performance" />
                    </Form.Item>

                    <Form.Item
                      label="Report Type"
                      name="reportType"
                      rules={[{ required: true, message: "请选择 Report Type" }]}
                    >
                      <Radio.Group
                        options={[
                          { label: "Deals", value: "Deals" },
                          { label: "Facilities", value: "Facilities" },
                          { label: "Tools", value: "Tools" },
                        ]}
                      />
                    </Form.Item>

                    <Form.Item label="写入模式" name="mode">
                      <Radio.Group
                        options={[
                          { label: "replace（覆盖同名报告）", value: "replace" },
                          { label: "append（追加到已有报告）", value: "append" },
                        ]}
                      />
                    </Form.Item>

                    <Form.Item label="选择文件夹（仅 .xlsx）">
                      <Upload
                        directory
                        multiple
                        beforeUpload={(file, fileListFromFolder) => {
                          const casted = fileListFromFolder as unknown as File[];
                          const unique = casted.filter(
                            (item, idx) =>
                              casted.findIndex(
                                (x) =>
                                  x.name === item.name &&
                                  x.size === item.size &&
                                  x.lastModified === item.lastModified,
                              ) === idx,
                          );
                          setSelectedFolderFiles(unique);
                          return false;
                        }}
                        fileList={folderFileList}
                        onRemove={(file) => {
                          setSelectedFolderFiles((prev) => prev.filter((x) => x.name !== file.name));
                          return true;
                        }}
                      >
                        <Button icon={<UploadOutlined />}>选择文件夹</Button>
                      </Upload>
                    </Form.Item>

                    <Space style={{ marginBottom: 12 }}>
                      <Typography.Text type="secondary">
                        当前已选择 {selectedFolderFiles.length} 个文件
                      </Typography.Text>
                    </Space>

                    {uploadFolderMutation.isPending ? (
                      <Progress percent={folderProgress} status="active" />
                    ) : null}

                    <Space style={{ marginTop: 12 }}>
                      <Button type="primary" htmlType="submit" loading={uploadFolderMutation.isPending}>
                        开始批量上传
                      </Button>
                      {lastFolderResult ? (
                        <Button onClick={() => router.push(`/reports/${lastFolderResult.reportKey}`)}>
                          查看报告
                        </Button>
                      ) : null}
                    </Space>
                  </Form>

                  {lastFolderResult ? (
                    <Card size="small" style={{ marginTop: 16 }}>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Typography.Text>
                          report_key: <strong>{lastFolderResult.reportKey}</strong>
                        </Typography.Text>
                        <Typography.Text>
                          total: {lastFolderResult.totalFiles} / success: {lastFolderResult.succeededFiles} / failed: {lastFolderResult.failedFiles}
                        </Typography.Text>
                        <Table<UploadFolderFileResult>
                          rowKey={(row) => `${row.source_file}-${row.chapter_key || ""}-${row.section_key || ""}`}
                          size="small"
                          pagination={{ pageSize: 8 }}
                          columns={folderColumns}
                          dataSource={lastFolderResult.files}
                          scroll={{ x: 960 }}
                        />
                      </Space>
                    </Card>
                  ) : null}
                </>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}