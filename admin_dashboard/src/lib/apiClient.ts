const API_URL: string = window.__LEXA_CONFIG__?.apiUrl || window.location.origin;

declare global {
  interface Window {
    __LEXA_CONFIG__?: { apiUrl: string };
  }
}

interface RequestOptions extends Omit<RequestInit, 'method' | 'body'> {}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  method: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    credentials: 'include',
    ...options,
  });

  if (!res.ok) {
    let data: unknown;
    try {
      data = await res.json();
    } catch {}
    const msg = (data as { detail?: string })?.detail || `Request failed: ${res.status}`;
    throw new ApiError(res.status, msg, data);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, 'GET', undefined, options);
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, 'POST', body, options);
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, 'PUT', body, options);
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, 'DELETE', undefined, options);
  },

  upload<T>(path: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return request<T>(path, 'POST', formData, options);
  },

  authGet<T>(path: string): Promise<T> {
    return this.get<T>(path);
  },

  authPost<T>(path: string, body?: unknown): Promise<T> {
    return this.post<T>(path, body);
  },

  authDelete<T>(path: string): Promise<T> {
    return this.delete<T>(path);
  },

  authUpload<T>(path: string, formData: FormData): Promise<T> {
    return this.upload<T>(path, formData);
  },
};

export { ApiError };
export default api;
