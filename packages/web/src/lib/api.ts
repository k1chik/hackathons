const API_BASE = import.meta.env.VITE_API_URL || "/api";

// ─────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────

export interface InspectionResult {
  equipmentId: string;
  timestamp: string;
  overallCondition: "GOOD" | "FAIR" | "POOR" | "CRITICAL";
  conditionScore: number;
  findings: Finding[];
  historicalContext: HistoricalMatch[];
  recommendations: string[];
  immediateAction: boolean;
  summary: string;
  inspectorNotes?: string;
  photoUrl?: string;
}

export interface Finding {
  component: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  progression?: string;
}

export interface HistoricalMatch {
  type: "PROGRESSION" | "PATTERN_MATCH";
  description: string;
  referenceUnit?: string;
  referenceDate?: string;
}

export interface FleetSummary {
  total: number;
  critical: number;
  poor: number;
  fair: number;
  good: number;
  immediateActionRequired: number;
  units: FleetUnit[];
}

export interface FleetUnit {
  equipmentId: string;
  equipmentType: string;
  lastInspection: string;
  overallCondition: string;
  conditionScore: number;
  previousConditionScore?: number;
  immediateAction: boolean;
  summary: string;
}

// ─────────────────────────────────────────────────────────────
// Auth API
// ─────────────────────────────────────────────────────────────

export interface AuthUser {
  email: string;
  tenantId: string;
  orgName: string;
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function signupUser(
  email: string,
  password: string,
  orgName: string
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, orgName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Signup failed" }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function joinOrg(
  email: string,
  password: string,
  inviteCode: string
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, inviteCode: inviteCode.toUpperCase() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to join org" }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function forgotPassword(email: string): Promise<void> {
  await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Reset failed" }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
}

export async function getOrgInviteCode(): Promise<{ inviteCode: string; orgName: string }> {
  const res = await apiFetch(`${API_BASE}/auth/invite-code`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// Authenticated fetch wrapper
// ─────────────────────────────────────────────────────────────

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("sensill_token");
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("sensill_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  return res;
}

// ─────────────────────────────────────────────────────────────
// API functions (all use apiFetch)
// ─────────────────────────────────────────────────────────────

export async function submitInspection(
  params: {
    equipmentId: string;
    equipmentType: string;
    imageBase64: string;
    mediaType: string;
    inspectorNotes?: string;
  },
  onProgress: (step: number, message: string) => void
): Promise<InspectionResult> {
  const res = await apiFetch(`${API_BASE}/inspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as Record<string, unknown>;
        if (event.type === "progress") onProgress(event.step as number, event.message as string);
        if (event.type === "result") return event.payload as InspectionResult;
        if (event.type === "error") throw new Error(event.message as string);
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  throw new Error("Stream ended without result");
}

export async function getEquipmentHistory(equipmentId: string) {
  const res = await apiFetch(`${API_BASE}/equipment/${encodeURIComponent(equipmentId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getFleet(): Promise<FleetSummary> {
  const res = await apiFetch(`${API_BASE}/fleet`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

export async function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result.split(",")[1], mediaType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function conditionColor(condition: string): string {
  switch (condition) {
    case "GOOD": return "text-status-good";
    case "FAIR": return "text-status-fair";
    case "POOR": return "text-status-poor";
    case "CRITICAL": return "text-status-critical";
    default: return "text-white";
  }
}

export function conditionBadge(condition: string): string {
  switch (condition) {
    case "GOOD": return "badge-good";
    case "FAIR": return "badge-fair";
    case "POOR": return "badge-poor";
    case "CRITICAL": return "badge-critical";
    default: return "";
  }
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "LOW": return "text-status-good";
    case "MEDIUM": return "text-status-fair";
    case "HIGH": return "text-status-poor";
    case "CRITICAL": return "text-status-critical";
    default: return "text-white";
  }
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
