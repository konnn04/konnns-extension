/** Tiny typed event bus so modules can talk without importing each other. */

type Handler<T = unknown> = (payload: T) => void;

export interface AppEvents {
  "onboarding:open": void;
  "settings:open": { featureId?: string };
  "wallpaper:changed": { id: string | null };
}

const handlers = new Map<keyof AppEvents, Set<Handler<never>>>();

export function on<K extends keyof AppEvents>(event: K, handler: Handler<AppEvents[K]>): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(handler as Handler<never>);
  return () => handlers.get(event)?.delete(handler as Handler<never>);
}

export function emit<K extends keyof AppEvents>(
  event: K,
  ...payload: AppEvents[K] extends void ? [] : [AppEvents[K]]
): void {
  handlers.get(event)?.forEach((h) => (h as Handler<AppEvents[K] | undefined>)(payload[0]));
}
