export const API_BASE = "/api/v1";

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem("ghost_token");
  }

  public setToken(token: string) {
    localStorage.setItem("ghost_token", token);
  }

  public clearToken() {
    localStorage.removeItem("ghost_token");
  }

  public async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && !endpoint.includes("/auth/login")) {
      this.clearToken();
      window.dispatchEvent(new Event("auth-expired"));
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = data?.error?.message || `Request failed with status ${res.status}`;
      const err = new Error(errorMsg) as any;
      err.data = data;
      err.code = data?.error?.code;
      throw err;
    }

    return data as T;
  }

  public get<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: "GET" });
  }

  public post<T = any>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T = any>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const api = new ApiClient();
