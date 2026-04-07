"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload/interface";
import { UploadOutlined } from "@ant-design/icons";
import { http } from "@/lib/http";
import { useUploadFolderMutation } from "@/features/reports/hooks";
import type { UploadFolderFileResult } from "@/features/reports/types";

type FolderFormValues = {
  reportKey: string;
  reportName: string;
  reportType: "Deals" | "Facilities" | "Tools" | "Performance";
  mode: "replace" | "append";
};

export default function ReportUploadPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [folderProgress, setFolderProgress] = useState<number>(0);
  const [selectedFolderFiles, setSelectedFolderFiles] = useState<File[]>([]);
  const [lastFolderResult, setLastFolderResult] = useState<{
    reportKey: string;
    totalFiles: number;
    succeededFiles: number;
    failedFiles: number;
    files: UploadFolderFileResult[];
  } | null>(null);

  const router = useRouter();
  const uploadFolderMutation = useUploadFolderMutation();
  const [folderForm] = Form.useForm<FolderFormValues>();

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
                          { label: "Performance", value: "Performance" },
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
      </Card>
    </>
  );
}