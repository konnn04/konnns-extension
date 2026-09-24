import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCodeStyling, { type Options } from "qr-code-styling";
import { Check, Copy, Download } from "lucide-react";
import { Button, Slider } from "@/shared/ui";
import { buildQrPayload, utf8ByteString } from "../engine/encoder";
import { renderFramedCanvas, renderFramedSvg } from "../engine/frameRenderer";
import type { QrConfig } from "../types";

interface PreviewPanelProps {
  config: QrConfig;
}

export function PreviewPanel({ config }: PreviewPanelProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<QRCodeStyling | null>(null);

  const [downloadSize, setDownloadSize] = useState<number>(1000);
  const [copied, setCopied] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  // Initialize and update QRCodeStyling cleanly on config change
  useEffect(() => {
    const payload = utf8ByteString(buildQrPayload(config));

    const qrOptions: Options = {
      width: 440,
      height: 440,
      type: "svg",
      data: payload,
      margin: config.options.margin * 2,
      qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: config.options.errorCorrectionLevel,
      },
      image: config.logo.url,
      imageOptions: {
        hideBackgroundDots: config.logo.clearBackground,
        imageSize: config.logo.size,
        margin: config.logo.margin,
        crossOrigin: "anonymous",
      },
      dotsOptions: {
        type: config.dots.type,
        color: config.dots.color,
        gradient:
          config.dots.useGradient &&
          config.dots.gradient.type !== "none" &&
          config.dots.gradient.colorStops?.length
            ? {
                type: config.dots.gradient.type,
                rotation: (config.dots.gradient.rotation * Math.PI) / 180,
                colorStops: config.dots.gradient.colorStops,
              }
            : undefined,
      },
      cornersSquareOptions: {
        type: config.cornersSquare.type === "dot" ? "extra-rounded" : config.cornersSquare.type,
        color: config.cornersSquare.useCustomColor
          ? config.cornersSquare.color
          : config.dots.color,
      },
      cornersDotOptions: {
        type: config.cornersDot.type,
        color: config.cornersDot.useCustomColor
          ? config.cornersDot.color
          : config.dots.color,
      },
      backgroundOptions: {
        color: config.background.transparent ? "transparent" : config.background.color,
      },
    };

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      try {
        const qr = new QRCodeStyling(qrOptions);
        qr.append(containerRef.current);
        qrInstanceRef.current = qr;
      } catch (err) {
        console.error("QR render error:", err);
      }
    }
  }, [config]);

  // Export handlers
  const getRenderedFramedCanvas = async (size: number): Promise<HTMLCanvasElement> => {
    const payload = utf8ByteString(buildQrPayload(config));
    // Create an offscreen QRCodeStyling instance at high resolution
    const highResQr = new QRCodeStyling({
      width: size,
      height: size,
      data: payload,
      margin: config.options.margin * 4,
      qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: config.options.errorCorrectionLevel,
      },
      image: config.logo.url,
      imageOptions: {
        hideBackgroundDots: config.logo.clearBackground,
        imageSize: config.logo.size,
        margin: config.logo.margin,
        crossOrigin: "anonymous",
      },
      dotsOptions: {
        type: config.dots.type,
        color: config.dots.color,
        gradient:
          config.dots.useGradient &&
          config.dots.gradient.type !== "none" &&
          config.dots.gradient.colorStops?.length
            ? {
                type: config.dots.gradient.type,
                rotation: (config.dots.gradient.rotation * Math.PI) / 180,
                colorStops: config.dots.gradient.colorStops,
              }
            : undefined,
      },
      cornersSquareOptions: {
        type: config.cornersSquare.type === "dot" ? "extra-rounded" : config.cornersSquare.type,
        color: config.cornersSquare.useCustomColor
          ? config.cornersSquare.color
          : config.dots.color,
      },
      cornersDotOptions: {
        type: config.cornersDot.type,
        color: config.cornersDot.useCustomColor
          ? config.cornersDot.color
          : config.dots.color,
      },
      backgroundOptions: {
        color: config.background.transparent ? "transparent" : config.background.color,
      },
    });

    const blob = await highResQr.getRawData("png");
    if (!blob) throw new Error("Could not render QR code");

    const img = new Image();
    const url = URL.createObjectURL(blob as Blob);
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });

    const rawCanvas = document.createElement("canvas");
    rawCanvas.width = size;
    rawCanvas.height = size;
    const ctx = rawCanvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);

    return renderFramedCanvas(rawCanvas, config, size);
  };

  const handleDownloadRaster = async (format: "png" | "jpeg" | "webp") => {
    try {
      setExporting(true);
      const canvas = await getRenderedFramedCanvas(downloadSize);
      const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
      const dataUrl = canvas.toDataURL(mime, 0.95);

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `qrcode_${downloadSize}x${downloadSize}.${format}`;
      link.click();
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadSvg = async () => {
    try {
      setExporting(true);
      const payload = utf8ByteString(buildQrPayload(config));
      const highResQr = new QRCodeStyling({
        width: downloadSize,
        height: downloadSize,
        data: payload,
        margin: config.options.margin * 4,
        qrOptions: {
          typeNumber: 0,
          mode: "Byte",
          errorCorrectionLevel: config.options.errorCorrectionLevel,
        },
        image: config.logo.url,
        imageOptions: {
          hideBackgroundDots: config.logo.clearBackground,
          imageSize: config.logo.size,
          margin: config.logo.margin,
          crossOrigin: "anonymous",
        },
        dotsOptions: {
          type: config.dots.type,
          color: config.dots.color,
          gradient:
            config.dots.useGradient &&
            config.dots.gradient.type !== "none" &&
            config.dots.gradient.colorStops?.length
              ? {
                  type: config.dots.gradient.type,
                  rotation: (config.dots.gradient.rotation * Math.PI) / 180,
                  colorStops: config.dots.gradient.colorStops,
                }
              : undefined,
        },
        cornersSquareOptions: {
          type: config.cornersSquare.type === "dot" ? "extra-rounded" : config.cornersSquare.type,
          color: config.cornersSquare.useCustomColor
            ? config.cornersSquare.color
            : config.dots.color,
        },
        cornersDotOptions: {
          type: config.cornersDot.type,
          color: config.cornersDot.useCustomColor
            ? config.cornersDot.color
            : config.dots.color,
        },
        backgroundOptions: {
          color: config.background.transparent ? "transparent" : config.background.color,
        },
      });

      const rawBlob = await highResQr.getRawData("svg");
      const text = await (rawBlob as Blob).text();
      const framedSvg = renderFramedSvg(text, config, downloadSize);

      const blob = new Blob([framedSvg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `qrcode.svg`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyImage = async () => {
    try {
      setExporting(true);
      const canvas = await getRenderedFramedCanvas(1000);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              "image/png": blob,
            }),
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
        } catch {
          /* clipboard write image failed */
        }
      }, "image/png");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="qrg-preview-card">
      <div className="qrg-preview-header">
        <h3 className="qrg-preview-title">{t("qr.preview.title")}</h3>
        {config.frame.type !== "none" && (
          <span className="qrg-preview-badge">{t("qr.preview.framed")}</span>
        )}
      </div>

      {/* Frame Preview Wrapper */}
      <div className={`qrg-preview-stage qrg-stage--frame-${config.frame.type}`}>
        {config.frame.type === "top" && (
          <div
            className="qrg-frame-banner qrg-frame-banner--top"
            style={{
              background: config.frame.color,
              color: config.frame.textColor,
            }}
          >
            {config.frame.text || t("qr.placeholders.frameText", "SCAN ME")}
          </div>
        )}

        <div
          className="qrg-qr-canvas-wrap"
          style={{
            background: config.background.transparent ? "transparent" : config.background.color,
          }}
        >
          <div ref={containerRef} className="qrg-qr-canvas" />
        </div>

        {config.frame.type === "bottom" && (
          <div
            className="qrg-frame-banner qrg-frame-banner--bottom"
            style={{
              background: config.frame.color,
              color: config.frame.textColor,
            }}
          >
            {config.frame.text || t("qr.placeholders.frameText", "SCAN ME")}
          </div>
        )}

        {config.frame.type === "badge" && (
          <div
            className="qrg-frame-badge"
            style={{
              background: config.frame.color,
              color: config.frame.textColor,
            }}
          >
            {config.frame.text || t("qr.placeholders.frameText", "SCAN ME")}
          </div>
        )}

        {config.frame.type === "phone" && (
          <div
            className="qrg-frame-phone-text"
            style={{
              color: config.frame.color,
            }}
          >
            {config.frame.text || t("qr.placeholders.frameText", "SCAN ME")}
          </div>
        )}
      </div>

      {/* Size resolution slider */}
      <div className="qrg-size-control">
        <div className="qrg-size-label">
          <span>{t("qr.preview.imageSize")}</span>
          <strong>{`${downloadSize} × ${downloadSize} px`}</strong>
        </div>
        <Slider
          min={400}
          max={2000}
          step={100}
          value={downloadSize}
          onChange={setDownloadSize}
        />
      </div>

      {/* Action buttons */}
      <div className="qrg-export-section">
        <div className="qrg-export-label">{t("qr.preview.downloadAs")}</div>
        <div className="qrg-export-buttons">
          <Button
            variant="primary"
            disabled={exporting}
            onClick={() => void handleDownloadRaster("png")}
          >
            <Download size={15} />
            <span>PNG</span>
          </Button>

          <Button
            variant="ghost"
            disabled={exporting}
            onClick={() => void handleDownloadSvg()}
          >
            <Download size={15} />
            <span>SVG</span>
          </Button>

          <Button
            variant="ghost"
            disabled={exporting}
            onClick={() => void handleDownloadRaster("webp")}
          >
            <Download size={15} />
            <span>WEBP</span>
          </Button>

          <Button
            variant="ghost"
            disabled={exporting}
            onClick={() => void handleDownloadRaster("jpeg")}
          >
            <Download size={15} />
            <span>JPEG</span>
          </Button>
        </div>

        <button
          type="button"
          className="qrg-copy-btn"
          disabled={exporting}
          onClick={() => void handleCopyImage()}
        >
          {copied ? <Check size={16} className="qrg-copied-icon" /> : <Copy size={16} />}
          <span>{copied ? t("qr.preview.copied") : t("qr.preview.copyImage")}</span>
        </button>
      </div>
    </div>
  );
}
