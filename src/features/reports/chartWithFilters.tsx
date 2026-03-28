"use client";

import ReactECharts from "echarts-for-react";
import { Empty, Table } from "antd";
import type { ReportChart } from "@/features/reports/types";

type Props = {
  chart: ReportChart;
  height?: number;
};

export function ChartWithFilters({ chart, height = 380 }: Props) {
  const tableColumns =
    chart.table_data?.columns?.map((column) => ({
      title: column.title,
      dataIndex: column.key,
      key: column.key,
    })) || [];

  if (chart.chart_type === "table") {
    return (
      <Table
        size="small"
        pagination={false}
        rowKey="__rowKey"
        columns={tableColumns}
        dataSource={(chart.table_data?.rows || []).map((row, index) => ({
          ...row,
          __rowKey: `${chart.chart_id}-${index}`,
        }))}
      />
    );
  }

  if (chart.echarts) {
    return <ReactECharts option={chart.echarts} notMerge lazyUpdate style={{ width: "100%", height }} />;
  }

  return <Empty description="该图表无 echarts option 数据" />;
}
