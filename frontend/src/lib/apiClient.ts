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
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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

  stream(path: string, body: unknown): Promise<Response> {
    return fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
};

export { ApiError };
export default api;