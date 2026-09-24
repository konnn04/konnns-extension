import { db } from "@/core/storage/db";
import { defaultSchedule, type ClearLogEntry, type ClearSchedule } from "./types";

const LOG_LIMIT = 50;

export async function getSchedule(): Promise<ClearSchedule> {
  const row = await db.autoClearSettings.get("state");
  return row ?? defaultSchedule();
}

export async function saveSchedule(schedule: ClearSchedule): Promise<void> {
  await db.autoClearSettings.put({ ...schedule, updatedAt: Date.now() });
}

export async function recordRun(entry: ClearLogEntry): Promise<void> {
  await db.clearLog.add(entry);
  // keep the log itself from growing forever — this tool's whole point is deleting other data, it shouldn't hoard its own
  const all = await db.clearLog.orderBy("ranAt").reverse().offset(LOG_LIMIT).primaryKeys();
  if (all.length > 0) await db.clearLog.bulkDelete(all);
}

export async function listLog(limit = LOG_LIMIT): Promise<ClearLogEntry[]> {
  return db.clearLog.orderBy("ranAt").reverse().limit(limit).toArray();
}
