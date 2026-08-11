export interface ErrorResponse {
  success: false;
  message: string;
  error: { code: string; details?: Record<string, string[]> };
  meta: { requestId: string };
}
