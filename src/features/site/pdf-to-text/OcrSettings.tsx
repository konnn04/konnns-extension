import { useTranslation } from "react-i18next";
import { Segmented } from "@/shared/ui";
import type { OcrLanguage } from "./engine/types";

/** Language picker for OCR — a first switch to a language downloads that language's traineddata (self-hosted, but still a few MB), so the size is called out here rather than only in a progress bar later. */
export function OcrSettings({
  language,
  onChange,
}: {
  language: OcrLanguage;
  onChange: (lang: OcrLanguage) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="pdftxt__ocr-settings">
      <span>{t("pdfText.ocrLanguage")}</span>
      <Segmented
        value={language}
        onChange={(v) => onChange(v as OcrLanguage)}
        options={[
          { value: "eng", label: t("pdfText.ocrLangEng") },
          { value: "vie", label: t("pdfText.ocrLangVie") },
        ]}
      />
    </div>
  );
}
