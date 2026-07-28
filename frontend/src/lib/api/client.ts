export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Thin fetch wrapper every service call goes through. Keeping one seam here means
 * swapping a mock route handler for a real backend call never touches UI code.
 */
export async function apiRequest<TResponse>(
  path: string,
  { method = "GET", body, signal }: RequestOptions = {},
): Promise<TResponse> {
  const isFormData = body instanceof FormData;

  const response = await fetch(path, {
    method,
    headers: body && !isFormData ? { "Content-Type": "application/json" } : undefined,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      payload?.error ?? `Request to ${path} failed with status ${response.status}`,
      response.status,
    );
  }

  return response.json() as Promise<TResponse>;
}
