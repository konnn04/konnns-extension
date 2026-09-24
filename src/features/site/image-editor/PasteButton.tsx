import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardPaste } from "lucide-react";
import { Button } from "@/shared/ui";
import { hasPermissions, requestPermissions } from "@/core/permissions";
import type { EditorCanvasHandle } from "./EditorCanvas";

/**
 * The mouse route into the clipboard — docs/roadmap/07-image-editor.md §2
 * step 2 / §5. Deliberately a different mechanism from Ctrl+V: a native
 * `paste` event carries the user's own gesture and needs no permission at
 * all, but reading the clipboard on a button press has no such event to ride
 * and needs `clipboardRead` (declared optional, asked for here, at the only
 * moment it is actually useful).
 */
export function PasteButton({
  canvasRef,
  onError,
}: {
  canvasRef: React.RefObject<EditorCanvasHandle | null>;
  onError: (messageKey: string) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const paste = async () => {
    setBusy(true);
    try {
      const granted = (await hasPermissions({ permissions: ["clipboardRead"] })) ||
        // must stay inside this click handler — see core/permissions.ts
        (await requestPermissions({ permissions: ["clipboardRead"] }));
      if (!granted) {
        onError("imageEditor.clipboardDenied");
        return;
      }

      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((ty) => ty.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        const dataURL = await blobToDataURL(blob);
        await canvasRef.current?.addImageFromDataURL(dataURL);
        return;
      }
      onError("imageEditor.clipboardNoImage");
    } catch {
      onError("imageEditor.clipboardFailed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button disabled={busy} onClick={() => void paste()}>
      <ClipboardPaste size={15} />
      {t("imageEditor.paste")}
    </Button>
  );
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}
