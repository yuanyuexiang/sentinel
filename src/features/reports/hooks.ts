import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createReport,
  deleteReport,
  getReportDetail,
  getReports,
  getSectionDetail,
  updateReport,
  uploadExcel,
} from "@/features/reports/api";
import type { CreateReportInput, UpdateReportInput } from "@/features/reports/types";

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

export function useCreateReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateReportInput) => createReport(input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: reportKeys.list() });
      queryClient.setQueryData(reportKeys.detail(data.report_key), data);
    },
  });
}

export function useUpdateReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { reportKey: string; payload: UpdateReportInput }) =>
      updateReport(input.reportKey, input.payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: reportKeys.list() });
      queryClient.setQueryData(reportKeys.detail(data.report_key), data);
    },
  });
}

export function useDeleteReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reportKey: string) => deleteReport(reportKey),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: reportKeys.list() });
      queryClient.removeQueries({ queryKey: reportKeys.detail(data.report_key) });
    },
  });
}