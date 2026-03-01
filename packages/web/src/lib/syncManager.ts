import {
  getPendingInspections,
  updateInspectionStatus,
  removeInspection,
} from "./offlineQueue";
import { submitInspection } from "./api";

const MAX_RETRIES = 3;
let syncing = false;

export async function syncPendingInspections(): Promise<void> {
  if (syncing) return;
  syncing = true;

  try {
    const all = await getPendingInspections();
    const toSubmit = all.filter(
      (i) => i.status === "pending" || (i.status === "failed" && i.retryCount < MAX_RETRIES)
    );

    for (const inspection of toSubmit) {
      await updateInspectionStatus(inspection.id, "submitting");
      try {
        await submitInspection(
          {
            equipmentId: inspection.equipmentId,
            equipmentType: inspection.equipmentType,
            imageBase64: inspection.imageBase64,
            mediaType: inspection.mediaType,
            inspectorNotes: inspection.inspectorNotes,
          },
          () => {} // background — no progress UI
        );
        await removeInspection(inspection.id);
      } catch {
        const newCount = inspection.retryCount + 1;
        await updateInspectionStatus(
          inspection.id,
          newCount >= MAX_RETRIES ? "failed" : "pending",
          newCount
        );
      }
      // Notify any mounted components to re-read the queue
      window.dispatchEvent(new Event("sensill:queue-updated"));
    }
  } finally {
    syncing = false;
  }
}
