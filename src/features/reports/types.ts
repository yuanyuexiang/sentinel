export type ReportListItem = {
  id?: string;
  report_key: string;
  name: string;
  type: string;
  status: string;
  published_version: number;
};

export type UploadExcelResult = {
  report_key: string;
  source_file: string;
  parsed_charts: number;
  parsed_points: number;
};

export type AssembleResult = {
  report_key: string;
  snapshot_id: number;
  payload_hash: string;
};

export type PublishResult = {
  report_key: string;
  published_version: number;
  snapshot_id: number;
};

export type ReportChart = {
  chart_id: string;
  chart_type: string;
  title: string;
  subtitle?: string | null;
  echarts?: Record<string, unknown> | null;
  table_data?: {
    columns?: Array<{ key: string; title: string; align?: string }>;
    rows?: Array<Record<string, unknown>>;
  } | null;
  meta?: Record<string, unknown>;
};

export type ReportSection = {
  section_key: string;
  title: string;
  subtitle?: string | null;
  order?: number;
  content_items?: {
    charts?: ReportChart[];
  };
};

export type ReportDetail = {
  id?: string;
  report_key: string;
  name: string;
  type: string;
  status: string;
  published_version: number;
  sections: ReportSection[];
};

export type CreateReportInput = {
  report_key: string;
  name: string;
  type: string;
  status: string;
  sections?: ReportSection[];
};

export type UpdateReportInput = {
  name?: string;
  type?: string;
  status?: string;
  sections?: ReportSection[];
};