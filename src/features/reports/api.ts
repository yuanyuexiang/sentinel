import type { AxiosProgressEvent } from "axios";
import { http } from "@/lib/http";
import {
  assembleResultSchema,
  publishResultSchema,
  reportDetailSchema,
  reportListSchema,
  reportSectionSchema,
  uploadExcelResultSchema,
} from "@/features/reports/schemas";
import type {
  AssembleResult,
  CreateReportInput,
  PublishResult,
  ReportDetail,
  ReportListItem,
  ReportSection,
  UpdateReportInput,
  UploadExcelResult,
} from "@/features/reports/types";

type ReportListResponse =
  | {
      items?: ReportListItem[];
    }
  | ReportListItem[];

export async function getReports(): Promise<ReportListItem[]> {
  const payload = await http.get<ReportListResponse>("/v1/reports");
  const rawItems = Array.isArray(payload) ? payload : payload.items || [];
  return reportListSchema.parse(rawItems);
}

export async function uploadExcel(input: {
  file: File;
  reportKey?: string;
  onUploadProgress?: (event: AxiosProgressEvent) => void;
}): Promise<UploadExcelResult> {
  const formData = new FormData();
  formData.append("file", input.file);

  if (input.reportKey) {
    formData.append("report_key", input.reportKey);
  }

  const payload = await http.post<UploadExcelResult, FormData>("/v1/reports/upload-excel", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: input.onUploadProgress,
  });

  return uploadExcelResultSchema.parse(payload);
}

export async function assembleReport(reportKey: string): Promise<AssembleResult> {
  const payload = await http.post<AssembleResult, { report_key: string }>("/v1/reports/assemble", {
    report_key: reportKey,
  });
  return assembleResultSchema.parse(payload);
}

export async function publishReport(input: {
  reportKey: string;
  snapshotId: number;
  comment?: string;
}): Promise<PublishResult> {
  const payload = await http.post<PublishResult, { snapshot_id: number; comment?: string }>(
    `/v1/reports/${input.reportKey}/publish`,
    {
      snapshot_id: input.snapshotId,
      comment: input.comment,
    },
  );
  return publishResultSchema.parse(payload);
}

export async function getReportDetail(reportKey: string): Promise<ReportDetail> {
  const payload = await http.get<
    | ReportDetail
    | {
        payload?: Partial<ReportDetail>;
      }
  >(`/v1/reports/${reportKey}`);

  const payloadObject = payload as {
    payload?: Partial<ReportDetail>;
  };

  const rawDetail: Partial<ReportDetail> = payloadObject.payload ?? (payload as Partial<ReportDetail>);

  return normalizeReportDetail(rawDetail, reportKey);
}

export async function getSectionDetail(reportKey: string, sectionKey: string): Promise<ReportSection> {
  const payload = await http.get<
    | ReportSection
    | {
        section?: ReportSection;
      }
  >(`/v1/reports/${reportKey}/sections/${sectionKey}`);

  const payloadObject = payload as {
    section?: ReportSection;
  };

  const rawSection: ReportSection | undefined = payloadObject.section ?? (payload as ReportSection);

  return reportSectionSchema.parse(
    rawSection || {
      section_key: sectionKey,
      title: sectionKey,
    },
  );
}

export async function createReport(input: CreateReportInput): Promise<ReportDetail> {
  const payload = await http.post<
    | ReportDetail
    | {
        payload?: Partial<ReportDetail>;
      },
    CreateReportInput
  >("/v1/reports", {
    ...input,
    sections: input.sections || [],
  });

  const payloadObject = payload as {
    payload?: Partial<ReportDetail>;
  };

  const rawDetail: Partial<ReportDetail> = payloadObject.payload ?? (payload as Partial<ReportDetail>);

  return normalizeReportDetail(rawDetail, input.report_key);
}

export async function updateReport(reportKey: string, input: UpdateReportInput): Promise<ReportDetail> {
  const payload = await http.patch<
    | ReportDetail
    | {
        payload?: Partial<ReportDetail>;
      },
    UpdateReportInput
  >(`/v1/reports/${reportKey}`, input);

  const payloadObject = payload as {
    payload?: Partial<ReportDetail>;
  };

  const rawDetail: Partial<ReportDetail> = payloadObject.payload ?? (payload as Partial<ReportDetail>);

  return normalizeReportDetail(rawDetail, reportKey);
}

export async function deleteReport(reportKey: string): Promise<{ report_key: string }> {
  const payload = await http.delete<
    | {
        report_key?: string;
      }
    | string
  >(`/v1/reports/${reportKey}`);

  if (typeof payload === "string") {
    return { report_key: payload };
  }

  return {
    report_key: payload.report_key || reportKey,
  };
}

function normalizeReportDetail(rawDetail: Partial<ReportDetail>, fallbackReportKey: string): ReportDetail {
  return reportDetailSchema.parse({
    id: rawDetail.id,
    report_key: rawDetail.report_key || fallbackReportKey,
    name: rawDetail.name || fallbackReportKey,
    type: rawDetail.type || "unknown",
    status: rawDetail.status || "draft",
    published_version: rawDetail.published_version ?? 0,
    sections: rawDetail.sections || [],
  });
}