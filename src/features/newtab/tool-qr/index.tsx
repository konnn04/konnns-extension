import { useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import { Download, QrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { Button, TextInput } from "@/shared/ui";
import "./qr.css";

export const QR_FEATURE_ID = "tool-qr";

function ToolQr() {
  const { t } = useTranslation();
  const [text, setText] = useState("");

  const cells = useMemo(() => {
    const value = text.trim();
    if (!value) return null;
    try {
      const qr = qrcode(0, "M");
      qr.addData(value);
      qr.make();
      const count = qr.getModuleCount();
      const dark: Array<[number, number]> = [];
      for (let r = 0; r < count; r++)
        for (let c = 0; c < count; c++) if (qr.isDark(r, c)) dark.push([r, c]);
      return { count, dark };
    } catch {
      return null;
    }
  }, [text]);

  const svgString = (() => {
    if (!cells) return "";
    const { count, dark } = cells;
    const m = 2; // quiet zone
    const size = count + m * 2;
    const rects = dark.map(([r, c]) => `<rect x="${c + m}" y="${r + m}" width="1" height="1"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
  })();

  const download = () => {
    const url = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "qrcode.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="qr">
      <TextInput
        placeholder={t("qr.placeholder")}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {cells ? (
        <>
          <div className="qr__code" dangerouslySetInnerHTML={{ __html: svgString }} />
          <Button size="sm" variant="ghost" onClick={download}>
            <Download size={15} /> {t("qr.download")}
          </Button>
        </>
      ) : (
        <p className="ui-field__desc">{t("qr.empty")}</p>
      )}
    </div>
  );
}

registerFeature({
  id: QR_FEATURE_ID,
  zone: "right-sidebar",
  nameKey: "features.tool-qr",
  icon: QrCode,
  defaultEnabled: false,
  component: ToolQr,
  order: 5,
});

export default ToolQr;
