import { z } from "zod";

export const reportListItemSchema = z.object({
  id: z.string().optional(),
  report_key: z.string(),
  name: z.string(),
  type: z.string(),
  status: z.string(),
  published_version: z.number().optional(),
  updated_at: z.string().optional(),
});

export const reportListSchema = z.array(reportListItemSchema);

export const uploadExcelResultSchema = z.object({
  report_key: z.string(),
  source_file: z.string(),
  parsed_charts: z.number(),
  parsed_points: z.number(),
});

export const uploadFolderFileResultSchema = z.object({
  source_file: z.string(),
  chapter_key: z.string().nullable().optional(),
  section_key: z.string().nullable().optional(),
  parsed_charts: z.number().default(0),
  parsed_points: z.number().default(0),
  status: z.string(),
  detail: z.string().nullable().optional(),
});

export const uploadFolderResultSchema = z.object({
  report_key: z.string(),
  total_files: z.number(),
  succeeded_files: z.number(),
  failed_files: z.number(),
  files: z.array(uploadFolderFileResultSchema),
});

export const uploadFolderTaskAcceptedSchema = z.object({
  task_id: z.string(),
  report_key: z.string(),
  status: z.string(),
  total_files: z.number(),
  submitted_at: z.string(),
});

export const uploadFolderTaskStatusSchema = z.object({
  task_id: z.string(),
  report_key: z.string(),
  status: z.string(),
  phase: z.string(),
  total_files: z.number(),
  processed_files: z.number(),
  succeeded_files: z.number(),
  failed_files: z.number(),
  submitted_at: z.string(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  files: z.array(uploadFolderFileResultSchema),
  detail: z.string().nullable().optional(),
  result: uploadFolderResultSchema.nullable().optional(),
});

export const saveReportResultSchema = z.object({
  report_key: z.string(),
  payload_hash: z.string().optional(),
  saved_at: z.string().optional(),
});

export const reportChartSchema = z.object({
  chart_id: z.string(),
  chart_type: z.string(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  echarts: z.record(z.string(), z.unknown()).nullable().optional(),
  table_data: z
    .object({
      columns: z
        .array(
          z.object({
            key: z.string(),
            title: z.string(),
            align: z.string().optional(),
          }),
        )
        .optional(),
      rows: z.array(z.record(z.string(), z.unknown())).optional(),
    })
    .nullable()
    .optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const reportSectionSchema = z.object({
  chapter_key: z.string().optional(),
  section_key: z.string(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  order: z.number().optional(),
  content_items: z
    .object({
      charts: z.array(reportChartSchema).optional(),
    })
    .optional(),
});

export const reportChapterSchema = z.object({
  chapter_key: z.string(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  order: z.number().optional(),
  status: z.string().optional(),
  sections: z.array(reportSectionSchema).optional(),
});

export const reportDetailSchema = z.object({
  id: z.string().optional(),
  report_key: z.string(),
  name: z.string(),
  type: z.string(),
  status: z.string(),
  published_version: z.number().optional(),
  updated_at: z.string().optional(),
  sections: z.array(reportSectionSchema),
  chapters: z.array(reportChapterSchema).optional(),
});

export const reportFormSchema = z.object({
  report_key: z.string().trim().min(1, "report_key 不能为空").optional(),
  name: z.string().trim().min(1, "name 不能为空"),
  type: z.string().trim().min(1, "type 不能为空"),
  status: z.string().trim().min(1, "status 不能为空"),
});