export type ApiErrorPayload = {
  field?: string;
  detail?: string;
} | null;

export type ApiEnvelope<T> = {
  code: number;
  message: string;
  data: T | null;
  error?: ApiErrorPayload;
};

export class ApiBusinessError extends Error {
  public readonly code: number;

  public readonly field?: string;

  constructor(input: { message: string; code: number; field?: string }) {
    super(input.message);
    this.name = "ApiBusinessError";
    this.code = input.code;
    this.field = input.field;
  }
}