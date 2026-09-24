/**
 * History labels — docs/site/01-audio-editor.md §2.
 *
 * A label is an i18n key plus interpolation params, never a finished string:
 * the project ships vi + en, and a history list full of English labels in a
 * Vietnamese UI would be worse than no labels at all. The UI runs it through
 * t() when it renders the history panel or an undo tooltip.
 *
 * Call sites build these directly. An earlier version derived them from an
 * operation union, but under the clip model an edit is a whole new project
 * tree rather than one enumerable op, so the tree-producing code is also the
 * code that knows what to call it.
 */
export interface CommandLabel {
  key: string;
  params?: Record<string, string | number>;
}
