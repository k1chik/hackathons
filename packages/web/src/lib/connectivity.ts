const API_BASE = import.meta.env.VITE_API_URL || "/api";

export async function isOnline(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(`${API_BASE}/health`, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}
