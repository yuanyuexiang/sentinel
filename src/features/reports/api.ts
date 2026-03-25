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
  ReportChapter,
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
    | (ReportDetail & { chapters?: ReportChapter[] })
    | {
        payload?: Partial<ReportDetail> & { chapters?: ReportChapter[] };
      }
  >(`/v1/reports/${reportKey}`);

  const payloadObject = payload as {
    payload?: Partial<ReportDetail> & { chapters?: ReportChapter[] };
  };

  const rawDetail: Partial<ReportDetail> & { chapters?: ReportChapter[] } =
    payloadObject.payload ?? (payload as Partial<ReportDetail> & { chapters?: ReportChapter[] });

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
  const writePayload = toWritePayload(input);

  const payload = await http.post<
    | (ReportDetail & { chapters?: ReportChapter[] })
    | {
        payload?: Partial<ReportDetail> & { chapters?: ReportChapter[] };
      },
    Record<string, unknown>
  >("/v1/reports", writePayload);

  const payloadObject = payload as {
    payload?: Partial<ReportDetail> & { chapters?: ReportChapter[] };
  };

  const rawDetail: Partial<ReportDetail> & { chapters?: ReportChapter[] } =
    payloadObject.payload ?? (payload as Partial<ReportDetail> & { chapters?: ReportChapter[] });

  return normalizeReportDetail(rawDetail, input.report_key, input.sections, input.chapters);
}

export async function updateReport(reportKey: string, input: UpdateReportInput): Promise<ReportDetail> {
  const writePayload = toWritePayload(input);

  const payload = await http.patch<
    | (ReportDetail & { chapters?: ReportChapter[] })
    | {
        payload?: Partial<ReportDetail> & { chapters?: ReportChapter[] };
      },
    Record<string, unknown>
  >(`/v1/reports/${reportKey}`, writePayload);

  const payloadObject = payload as {
    payload?: Partial<ReportDetail> & { chapters?: ReportChapter[] };
  };

  const rawDetail: Partial<ReportDetail> & { chapters?: ReportChapter[] } =
    payloadObject.payload ?? (payload as Partial<ReportDetail> & { chapters?: ReportChapter[] });

  return normalizeReportDetail(rawDetail, reportKey, input.sections, input.chapters);
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

function normalizeReportDetail(
  rawDetail: Partial<ReportDetail> & { chapters?: ReportChapter[] },
  fallbackReportKey: string,
  fallbackSections?: ReportSection[],
  fallbackChapters?: ReportChapter[],
): ReportDetail {
  const sections = extractSections(rawDetail, fallbackSections, fallbackChapters);
  const chapters = extractChapters(rawDetail, sections, fallbackChapters);

  return reportDetailSchema.parse({
    id: rawDetail.id,
    report_key: rawDetail.report_key || fallbackReportKey,
    name: rawDetail.name || fallbackReportKey,
    type: rawDetail.type || "unknown",
    status: rawDetail.status || "draft",
    published_version: rawDetail.published_version ?? 0,
    sections,
    chapters,
  });
}

function toWritePayload(input: CreateReportInput | UpdateReportInput): Record<string, unknown> {
  const normalizedSections = normalizeSectionsForWrite(input.sections || []);
  const chapters = input.chapters ?? buildChaptersFromSections(normalizedSections, input.status);

  const payload: Record<string, unknown> = {
    ...input,
    chapters,
  };

  // New backend contract uses chapters as the structural source of truth.
  // Keep sections only for local compatibility, but do not send it in write payload.
  delete payload.sections;

  return payload;
}

function buildChaptersFromSections(sections: ReportSection[], status?: string): ReportChapter[] {
  if (!sections.length) {
    return [];
  }

  const grouped = new Map<string, ReportSection[]>();
  sections.forEach((section) => {
    const key = section.chapter_key || "chapter_1";
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(section);
  });

  return Array.from(grouped.entries()).map(([chapterKey, chapterSections], index) => ({
    chapter_key: chapterKey,
    title: chapterKey,
    subtitle: null,
    order: index + 1,
    status: status || "draft",
    sections: chapterSections.map((section) => ({
      ...section,
      chapter_key: undefined,
    })),
  }));
}

function extractSections(
  rawDetail: Partial<ReportDetail> & { chapters?: ReportChapter[] },
  fallbackSections?: ReportSection[],
  fallbackChapters?: ReportChapter[],
): ReportSection[] {
  if (rawDetail.sections && rawDetail.sections.length > 0) {
    const defaultChapterKey = rawDetail.chapters?.[0]?.chapter_key || fallbackChapters?.[0]?.chapter_key || "chapter_1";
    return rawDetail.sections.map((section) => ({
      ...section,
      chapter_key: section.chapter_key || defaultChapterKey,
    }));
  }

  const chapters = rawDetail.chapters ?? fallbackChapters;
  if (chapters && chapters.length > 0) {
    const flattened = chapters.flatMap((chapter) =>
      (chapter.sections || []).map((section) => ({
        ...section,
        chapter_key: section.chapter_key || chapter.chapter_key,
      })),
    );
    if (flattened.length > 0) {
      return flattened;
    }
  }

  return fallbackSections ?? [];
}

function extractChapters(
  rawDetail: Partial<ReportDetail> & { chapters?: ReportChapter[] },
  normalizedSections: ReportSection[],
  fallbackChapters?: ReportChapter[],
): ReportChapter[] {
  if (rawDetail.chapters && rawDetail.chapters.length > 0) {
    return mergeChaptersWithFallback(rawDetail.chapters, fallbackChapters, rawDetail.status || "draft");
  }

  if (fallbackChapters && fallbackChapters.length > 0) {
    return fallbackChapters.map((chapter, index) => ({
      ...chapter,
      order: chapter.order || index + 1,
      status: chapter.status || rawDetail.status || "draft",
    }));
  }

  return buildChaptersFromSections(normalizedSections, rawDetail.status || "draft");
}

function mergeChaptersWithFallback(
  chapters: ReportChapter[],
  fallbackChapters: ReportChapter[] | undefined,
  defaultStatus: string,
): ReportChapter[] {
  if (!fallbackChapters || fallbackChapters.length === 0) {
    return chapters.map((chapter, index) => ({
      ...chapter,
      order: chapter.order || index + 1,
      status: chapter.status || defaultStatus,
    }));
  }

  const fallbackMap = new Map(fallbackChapters.map((chapter) => [chapter.chapter_key, chapter]));

  return chapters.map((chapter, index) => {
    const fallback = fallbackMap.get(chapter.chapter_key);
    const incomingTitle = (chapter.title || "").trim();
    const fallbackTitle = (fallback?.title || "").trim();
    const shouldUseFallbackTitle =
      Boolean(fallbackTitle) &&
      (!incomingTitle || incomingTitle === chapter.chapter_key || incomingTitle === fallback?.chapter_key);

    return {
      ...chapter,
      title: shouldUseFallbackTitle ? fallbackTitle : chapter.title || chapter.chapter_key,
      subtitle: chapter.subtitle ?? fallback?.subtitle ?? null,
      order: chapter.order || fallback?.order || index + 1,
      status: chapter.status || fallback?.status || defaultStatus,
      sections: chapter.sections || fallback?.sections || [],
    };
  });
}

function normalizeSectionsForWrite(sections: ReportSection[]): ReportSection[] {
  return sections.map((section) => ({
    ...section,
    chapter_key: section.chapter_key || "chapter_1",
  }));
}