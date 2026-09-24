/**
 * Shared shapes — docs/roadmap/05-audio-mixer.md §1.
 *
 * No store: `tabId` does not survive across browser restarts and the real
 * mute state already lives in the browser itself (`tab.mutedInfo`) — this
 * tool only reads and drives that, never a second source of truth for it.
 */
export interface MixerTab {
  tabId: number;
  windowId: number;
  title: string;
  favIconUrl?: string;
  /** actually producing sound right now */
  audible: boolean;
  muted: boolean;
}
