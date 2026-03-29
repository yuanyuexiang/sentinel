export type ReportListItem = {
  id?: string;
  report_key: string;
  name: string;
  type: string;
  status: string;
  published_version?: number;
  updated_at?: string;
};

export type UploadExcelResult = {
  report_key: string;
  source_file: string;
  parsed_charts: number;
  parsed_points: number;
};

export type UploadFolderFileResult = {
  source_file: string;
  chapter_key?: string | null;
  section_key?: string | null;
  parsed_charts: number;
  parsed_points: number;
  status: string;
  detail?: string | null;
};

export type UploadFolderResult = {
  report_key: string;
  total_files: number;
  succeeded_files: number;
  failed_files: number;
  files: UploadFolderFileResult[];
};

export type SaveReportResult = {
  report_key: string;
  payload_hash?: string;
  saved_at?: string;
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
  chapter_key?: string;
  section_key: string;
  title: string;
  subtitle?: string | null;
  content?: string | null;
  order?: number;
  content_items?: {
    charts?: ReportChart[];
  };
};

export type ReportChapter = {
  chapter_key: string;
  title: string;
  subtitle?: string | null;
  order?: number;
  status?: string;
  sections?: ReportSection[];
};

export type ReportDetail = {
  id?: string;
  report_key: string;
  name: string;
  type: string;
  status: string;
  published_version?: number;
  updated_at?: string;
  sections: ReportSection[];
  chapters?: ReportChapter[];
};

export type CreateReportInput = {
  report_key: string;
  name: string;
  type: string;
  status: string;
  sections?: ReportSection[];
  chapters?: ReportChapter[];
};

export type UpdateReportInput = {
  name?: string;
  type?: string;
  status?: string;
  sections?: ReportSection[];
  chapters?: ReportChapter[];
};