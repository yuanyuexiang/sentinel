import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assembleReport,
  getReportDetail,
  getReports,
  getSectionDetail,
  publishReport,
  uploadExcel,
} from "@/features/reports/api";

export const reportKeys = {
  all: ["reports"] as const,
  list: () => [...reportKeys.all, "list"] as const,
  detail: (reportKey: string) => [...reportKeys.all, "detail", reportKey] as const,
  section: (reportKey: string, sectionKey: string) =>
    [...reportKeys.all, "section", reportKey, sectionKey] as const,
};

export function useReportsQuery() {
  return useQuery({
    queryKey: reportKeys.list(),
    queryFn: getReports,
  });
}

export function useReportDetailQuery(reportKey: string) {
  return useQuery({
    queryKey: reportKeys.detail(reportKey),
    queryFn: () => getReportDetail(reportKey),
    enabled: Boolean(reportKey),
  });
}

export function useSectionDetailQuery(reportKey: string, sectionKey: string) {
  return useQuery({
    queryKey: reportKeys.section(reportKey, sectionKey),
    queryFn: () => getSectionDetail(reportKey, sectionKey),
    enabled: Boolean(reportKey && sectionKey),
  });
}

export function useUploadExcelMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadExcel,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reportKeys.list() });
    },
  });
}

export function useAssembleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assembleReport,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: reportKeys.list() });
      void queryClient.invalidateQueries({ queryKey: reportKeys.detail(data.report_key) });
    },
  });
}

export function usePublishMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: publishReport,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: reportKeys.list() });
      void queryClient.invalidateQueries({ queryKey: reportKeys.detail(data.report_key) });
    },
  });
}