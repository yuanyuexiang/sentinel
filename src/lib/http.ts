import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { ApiBusinessError, type ApiEnvelope } from "@/types/api";

const client = axios.create({
  baseURL: "",
  timeout: 20_000,
});

function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    // Browser always calls Next.js same-origin proxy to avoid CORS.
    return "/api/proxy";
  }

  return ensureBaseUrl();
}

function ensureBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const prefix = process.env.NEXT_PUBLIC_API_PREFIX;

  if (!baseUrl || !prefix) {
    throw new Error("Missing NEXT_PUBLIC_API_BASE_URL or NEXT_PUBLIC_API_PREFIX");
  }

  return `${baseUrl}${prefix}`;
}

function toErrorMessage(input: unknown): string {
  if (axios.isAxiosError(input)) {
    const responseData = input.response?.data as ApiEnvelope<unknown> | undefined;
    const detail = responseData?.error?.detail;
    return detail || responseData?.message || input.message || "请求失败";
  }

  if (input instanceof ApiBusinessError) {
    return input.message;
  }

  if (input instanceof Error) {
    return input.message;
  }

  return "未知错误";
}

function unwrapEnvelope<T>(envelope: ApiEnvelope<T>): T {
  if (envelope.code !== 0) {
    throw new ApiBusinessError({
      code: envelope.code,
      message: envelope.error?.detail || envelope.message || "业务处理失败",
      field: envelope.error?.field,
    });
  }

  if (envelope.data === null) {
    throw new ApiBusinessError({
      code: envelope.code,
      message: "响应数据为空",
    });
  }

  return envelope.data;
}

async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await client.get<ApiEnvelope<T>>(url, {
    ...config,
    baseURL: getApiBaseUrl(),
  });
  return unwrapEnvelope(response.data);
}

async function post<T, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await client.post<ApiEnvelope<T>>(url, body, {
    ...config,
    baseURL: getApiBaseUrl(),
  });
  return unwrapEnvelope(response.data);
}

async function patch<T, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig,
): Promise<T> {
  const response = await client.patch<ApiEnvelope<T>>(url, body, {
    ...config,
    baseURL: getApiBaseUrl(),
  });
  return unwrapEnvelope(response.data);
}

async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await client.delete<ApiEnvelope<T>>(url, {
    ...config,
    baseURL: getApiBaseUrl(),
  });
  return unwrapEnvelope(response.data);
}

export const http = {
  get,
  post,
  patch,
  delete: del,
  toErrorMessage,
};

export function isAxiosTransportError(error: unknown): error is AxiosError {
  return axios.isAxiosError(error);
}