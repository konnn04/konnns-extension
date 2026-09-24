/**
 * QR Config persistence — save/load/delete QR configurations
 * stored in localStorage for later editing.
 */
import type { QrConfig } from "../types";

const STORAGE_KEY = "konnns_qr_saved_configs";

export interface SavedQrConfig {
  id: string;
  name: string;
  config: QrConfig;
  createdAt: number;
  updatedAt: number;
}

function readAll(): SavedQrConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedQrConfig[];
  } catch {
    return [];
  }
}

function writeAll(items: SavedQrConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function listSavedConfigs(): SavedQrConfig[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveConfig(name: string, config: QrConfig, existingId?: string): SavedQrConfig {
  const items = readAll();
  const now = Date.now();

  if (existingId) {
    const idx = items.findIndex((x) => x.id === existingId);
    if (idx >= 0) {
      items[idx] = { ...items[idx], name, config, updatedAt: now };
      writeAll(items);
      return items[idx];
    }
  }

  const saved: SavedQrConfig = {
    id: crypto.randomUUID(),
    name,
    config,
    createdAt: now,
    updatedAt: now,
  };
  items.push(saved);
  writeAll(items);
  return saved;
}

export function deleteConfig(id: string): void {
  writeAll(readAll().filter((x) => x.id !== id));
}

export function renameConfig(id: string, name: string): void {
  const items = readAll();
  const idx = items.findIndex((x) => x.id === id);
  if (idx >= 0) {
    items[idx] = { ...items[idx], name, updatedAt: Date.now() };
    writeAll(items);
  }
}

export function duplicateConfig(id: string, copySuffix = "(bản sao)"): SavedQrConfig | null {
  const items = readAll();
  const existing = items.find((x) => x.id === id);
  if (!existing) return null;
  const now = Date.now();
  const duplicate: SavedQrConfig = {
    id: crypto.randomUUID(),
    name: `${existing.name} ${copySuffix}`.trim(),
    config: JSON.parse(JSON.stringify(existing.config)),
    createdAt: now,
    updatedAt: now,
  };
  items.push(duplicate);
  writeAll(items);
  return duplicate;
}

