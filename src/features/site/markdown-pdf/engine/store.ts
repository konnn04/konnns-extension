import { db } from "@/core/storage/db";
import type { MarkdownDoc } from "./types";

export async function listDocs(): Promise<MarkdownDoc[]> {
  return db.markdownDocs.orderBy("updatedAt").reverse().toArray();
}

export async function getDoc(id: string): Promise<MarkdownDoc | undefined> {
  return db.markdownDocs.get(id);
}

export async function saveDoc(doc: MarkdownDoc): Promise<void> {
  await db.markdownDocs.put(doc);
}

export async function deleteDoc(id: string): Promise<void> {
  await db.markdownDocs.delete(id);
}

export async function duplicateDoc(id: string, copySuffix = "(bản sao)"): Promise<MarkdownDoc | undefined> {
  const existing = await getDoc(id);
  if (!existing) return undefined;
  const copy: MarkdownDoc = {
    ...existing,
    id: crypto.randomUUID(),
    title: `${existing.title || "Untitled"} ${copySuffix}`.trim(),
    updatedAt: Date.now(),
  };
  await saveDoc(copy);
  return copy;
}

export async function renameDoc(id: string, title: string): Promise<void> {
  const existing = await getDoc(id);
  if (!existing) return;
  await saveDoc({ ...existing, title, updatedAt: Date.now() });
}
