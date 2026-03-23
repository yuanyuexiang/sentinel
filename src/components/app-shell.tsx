"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppstoreOutlined, FileSearchOutlined } from "@ant-design/icons";
import { Layout, Menu, Space, Typography } from "antd";

const { Header, Content, Sider } = Layout;

const menuItems = [
  {
    key: "/reports",
    icon: <FileSearchOutlined />,
    label: <Link href="/reports">报告列表</Link>,
  },
];

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const currentLabel = getCurrentLabel(pathname);

  const selectedKeys = menuItems
    .map((item) => item.key)
    .filter((key) => pathname === key || pathname.startsWith(`${key}/`));

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={240} theme="light" style={{ borderRight: "1px solid #dce7ef" }}>
        <div style={{ padding: "18px 18px 10px 18px" }}>
          <Typography.Title level={4} style={{ marginBottom: 4, lineHeight: 1.2 }}>
            BI Report 平台
          </Typography.Title>
          <Space size={6}>
            <AppstoreOutlined style={{ color: "#4b5a67" }} />
            <Typography.Text type="secondary">管理端</Typography.Text>
          </Space>
        </div>

        <Menu mode="inline" selectedKeys={selectedKeys} items={menuItems} style={{ borderInlineEnd: "none" }} />
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

  if (pathname.endsWith("/edit")) {
    return "内容编辑";
  }

  if (pathname.startsWith("/reports/")) {
    return "报告详情";
  }

  return "管理端";
}