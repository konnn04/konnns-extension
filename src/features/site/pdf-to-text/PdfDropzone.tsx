import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileWarning, FolderOpen, UploadCloud } from "lucide-react";
import { Button } from "@/shared/ui";

export function PdfDropzone({ onFile, error }: { onFile: (file: File) => void; error: string | null }) {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") return;
    onFile(file);
  };

  return (
    <div
      className={`pdftxt__dropzone ${dragOver ? "pdftxt__dropzone--over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        accept(e.dataTransfer.files[0]);
      }}
    >
      <UploadCloud size={40} />
      <p className="pdftxt__dropzone-title">{t("pdfText.dropTitle")}</p>
      <p className="pdftxt__dropzone-sub">{t("pdfText.dropSub")}</p>
      <Button variant="primary" onClick={() => inputRef.current?.click()}>
        <FolderOpen size={15} />
        {t("pdfText.pickFile")}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => accept(e.target.files?.[0])}
      />
      {error && (
        <p className="pdftxt__error">
          <FileWarning size={14} />
          {error}
        </p>
      )}
    </div>
  );
}
