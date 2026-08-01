import { BACKEND_BASE_URL } from "@/lib/backend/config";
import type { AuthSession } from "@/features/auth/types";

interface BackendUser {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

interface BackendTokenResponse {
  user: BackendUser;
  access_token: string;
  access_token_expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
}

function toAuthSession(data: BackendTokenResponse): AuthSession {
  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName: data.user.display_name,
      createdAt: data.user.created_at,
    },
    tokens: {
      accessToken: data.access_token,
      accessTokenExpiresIn: data.access_token_expires_in,
      refreshToken: data.refresh_token,
      refreshTokenExpiresIn: data.refresh_token_expires_in,
    },
  };
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail ?? `Backend responded with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export async function signup(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthSession> {
  const data = await postJson<BackendTokenResponse>("/api/v1/auth/signup", {
    email,
    password,
    display_name: displayName || null,
  });
  return toAuthSession(data);
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const data = await postJson<BackendTokenResponse>("/api/v1/auth/login", { email, password });
  return toAuthSession(data);
}

export async function refreshSession(refreshToken: string): Promise<AuthSession> {
  const data = await postJson<BackendTokenResponse>("/api/v1/auth/refresh", {
    refresh_token: refreshToken,
  });
  return toAuthSession(data);
}

export async function logout(refreshToken: string): Promise<void> {
  await postJson<void>("/api/v1/auth/logout", { refresh_token: refreshToken });
}

export async function fetchCurrentUser(accessToken: string): Promise<AuthSession["user"] | null> {
  const response = await fetch(`${BACKEND_BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Backend responded with ${response.status}`);

  const data: BackendUser = await response.json();
  return { id: data.id, email: data.email, displayName: data.display_name, createdAt: data.created_at };
}
