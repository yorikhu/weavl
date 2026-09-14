import { API } from "./env";

/** 统一 API 边界；后续替换模型与持久化实现时页面无需改 fetch。 */
export async function studioApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
    throw new Error(
      Array.isArray(error?.message) ? error.message[0] : error?.message || `请求失败 (${response.status})`,
    );
  }
  return response.json() as Promise<T>;
}

export const jsonBody = (value: unknown) => JSON.stringify(value);
