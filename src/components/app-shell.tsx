"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSearchOutlined, UploadOutlined } from "@ant-design/icons";
import { Layout, Menu, Typography } from "antd";

const { Header, Content, Sider } = Layout;

const menuItems = [
  {
    key: "/reports",
    icon: <FileSearchOutlined />,
    label: <Link href="/reports">报告列表</Link>,
  },
  {
    key: "/reports/upload",
    icon: <UploadOutlined />,
    label: <Link href="/reports/upload">上传 Excel</Link>,
  },
];

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  const selectedKeys = menuItems
    .map((item) => item.key)
    .filter((key) => pathname === key || pathname.startsWith(`${key}/`));

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={230} theme="light" style={{ borderRight: "1px solid #dce7ef" }}>
        <div style={{ padding: "18px 18px 10px 18px" }}>
          <Typography.Title level={4} style={{ marginBottom: 2 }}>
            Report Console
          </Typography.Title>
          <Typography.Text type="secondary">管理端</Typography.Text>
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
            justifyContent: "space-between",
            paddingInline: 20,
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            BI Report 平台
          </Typography.Title>
          <Typography.Text type="secondary">Excel 驱动 | Assemble & Publish</Typography.Text>
        </Header>
        <Content style={{ padding: 20 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}