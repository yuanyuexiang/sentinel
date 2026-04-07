"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layout, Menu, Space, Typography } from "antd";
import {
  DashboardOutlined,
  FileTextOutlined,
  PlusCircleOutlined,
  UploadOutlined,
} from "@ant-design/icons";

const { Header, Content, Sider } = Layout;

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const currentLabel = getCurrentLabel(pathname);
  const selectedMenuKey = getSelectedMenuKey(pathname);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        className="admin-sider"
        theme="light"
        width={220}
        style={{
          background: "#ffffff",
          borderRight: "1px solid #dce7ef",
          paddingTop: 12,
        }}
      >
        <div className="admin-sider-brand">
          <div className="admin-sider-brand-logo">BI</div>
          <div>
            <Typography.Title level={5} style={{ margin: 0, lineHeight: 1.1, color: "#12314f" }}>
              BI Report 平台
            </Typography.Title>
            <Typography.Text style={{ color: "#5f7891", fontSize: 12 }}>
              Management Console
            </Typography.Text>
          </div>
        </div>
        <Menu
          className="admin-sider-menu"
          theme="light"
          mode="inline"
          selectedKeys={[selectedMenuKey]}
          style={{ background: "transparent", borderInlineEnd: 0, paddingInline: 8 }}
          items={[
            {
              key: "reports",
              icon: <FileTextOutlined />,
              label: <Link href="/reports">报告列表</Link>,
            },
            {
              key: "new",
              icon: <PlusCircleOutlined />,
              label: <Link href="/reports/new">新建报告</Link>,
            },
            {
              key: "upload",
              icon: <UploadOutlined />,
              label: <Link href="/reports/upload">模板上传</Link>,
            },
          ]}
        />

        <div className="admin-sider-footer">
          <Space size={6}>
            <DashboardOutlined style={{ color: "#7dd3fc" }} />
            <Typography.Text style={{ color: "#6b7d90", fontSize: 12 }}>
              导航已就绪
            </Typography.Text>
          </Space>
        </div>
      </Sider>
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
          <Typography.Text type="secondary">当前：{currentLabel}</Typography.Text>
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

function getSelectedMenuKey(pathname: string): string {
  if (pathname === "/reports/upload") {
    return "upload";
  }

  if (pathname === "/reports/new") {
    return "new";
  }

  if (pathname.startsWith("/reports/")) {
    return "reports";
  }

  return "reports";
}