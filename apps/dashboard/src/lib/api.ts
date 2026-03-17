const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

interface QueuedRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  path: string;
  options: RequestOptions;
}

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private requestQueue: QueuedRequest[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  private async refreshToken(): Promise<boolean> {
    const rt = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
    if (!rt) return false;

    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) return false;

      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      localStorage.setItem('auth_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      document.cookie = `auth_token=${data.accessToken}; path=/; SameSite=Lax`;
      return true;
    } catch {
      return false;
    }
  }

  private handleRefreshFailure(): void {
    const hadToken = localStorage.getItem('auth_token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    // Only redirect to login if the user was previously authenticated
    // (prevents redirect loop on pages that don't require auth)
    if (hadToken) {
      window.location.href = '/login';
    }
  }

  private flushQueue(success: boolean): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];
    for (const entry of queue) {
      if (success) {
        this.request(entry.path, entry.options).then(entry.resolve, entry.reject);
      } else {
        entry.reject(new Error('Token refresh failed'));
      }
    }
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, headers: customHeaders, ...rest } = options;
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(customHeaders as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...rest,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401 && !path.startsWith('/auth/refresh') && this.getToken()) {
      if (this.isRefreshing) {
        return new Promise<T>((resolve, reject) => {
          this.requestQueue.push({
            resolve: resolve as (v: unknown) => void,
            reject,
            path,
            options,
          });
        });
      }

      this.isRefreshing = true;
      const success = await this.refreshToken();
      this.isRefreshing = false;

      if (success) {
        this.flushQueue(true);
        return this.request<T>(path, options);
      }

      this.flushQueue(false);
      this.handleRefreshFailure();
      throw new Error('Authentication expired');
    }

    if (response.status === 403) {
      const error = await response.json().catch(() => ({ message: 'Access denied' }));
      const msg = error.message ?? 'This feature requires a Pro license';
      throw new Error(msg);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message ?? `API Error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  delete<T>(path: string, options?: RequestOptions) {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  uploadFile<T>(
    path: string,
    formData: FormData,
    onProgress?: (percent: number) => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const token = this.getToken();
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as T);
          } catch {
            resolve(undefined as T);
          }
        } else if (xhr.status === 401) {
          this.handleRefreshFailure();
          reject(new Error('Authentication expired'));
        } else {
          try {
            const err = JSON.parse(xhr.responseText) as { message?: string };
            reject(new Error(err.message ?? `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      xhr.open('POST', `${this.baseUrl}${path}`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      // Do not set Content-Type — browser sets it with the multipart boundary
      xhr.send(formData);
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
