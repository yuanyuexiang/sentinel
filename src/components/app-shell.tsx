"use client";

import { usePathname } from "next/navigation";
import { Layout, Space, Typography } from "antd";

const { Header, Content } = Layout;

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const currentLabel = getCurrentLabel(pathname);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout>
        <Header
          style={{
            background: "var(--bg-panel)",
            borderBottom: "1px solid #dce7ef",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingInline: 20,
            minHeight: 72,
            height: "auto",
            lineHeight: "normal",
            paddingBlock: 10,
          }}
        >
          <Space size={10}>
            <Typography.Title level={4} style={{ margin: 0, lineHeight: 1.2 }}>
              BI Report 平台
            </Typography.Title>
            <Typography.Text type="secondary">当前：{currentLabel}</Typography.Text>
          </Space>
        </Header>

        <Content style={{ padding: 20 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}

function getCurrentLabel(pathname: string): string {
  if (pathname === "/reports") {
    return "报告列表";
  }

  if (pathname === "/reports/new") {
    return "新建报告";
  }

  if (pathname === "/reports/upload") {
    return "模板上传";
  }

  if (pathname.endsWith("/edit")) {
    return "内容编辑";
  }

  if (pathname.startsWith("/reports/")) {
    return "报告详情";
  }

  return "管理端";
}