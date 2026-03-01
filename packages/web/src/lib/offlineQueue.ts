import { openDB } from "idb";

const DB_NAME = "sensill-offline-db";
const STORE = "pending-inspections";

export interface PendingInspection {
  id: string;
  queuedAt: string;
  tenantId: string;
  equipmentId: string;
  equipmentType: string;
  imageBase64: string;
  mediaType: string;
  inspectorNotes?: string;
  status: "pending" | "submitting" | "failed";
  retryCount: number;
}

function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE, { keyPath: "id" });
    },
  });
}

export async function queueInspection(
  params: Omit<PendingInspection, "id" | "queuedAt" | "status" | "retryCount">
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put(STORE, {
    ...params,
    id,
    queuedAt: new Date().toISOString(),
    status: "pending",
    retryCount: 0,
  } satisfies PendingInspection);
  return id;
}

export async function getPendingInspections(): Promise<PendingInspection[]> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  // Reset any stuck "submitting" items back to "pending" — happens if app crashed mid-sync
  const stale = all.filter((i) => i.status === "submitting");
  for (const item of stale) {
    await db.put(STORE, { ...item, status: "pending" });
  }
  return all
    .map((i) => (i.status === "submitting" ? { ...i, status: "pending" as const } : i))
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function updateInspectionStatus(
  id: string,
  status: PendingInspection["status"],
  retryCount?: number
): Promise<void> {
  const db = await getDB();
  const item = await db.get(STORE, id);
  if (!item) return;
  await db.put(STORE, {
    ...item,
    status,
    ...(retryCount !== undefined ? { retryCount } : {}),
  });
}

export async function removeInspection(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  return all.filter((i) => i.status !== "failed" || i.retryCount < 3).length;
}
