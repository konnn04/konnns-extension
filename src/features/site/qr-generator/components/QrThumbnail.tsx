import { useEffect, useRef } from "react";
import QRCodeStyling, { type Options } from "qr-code-styling";
import type { QrConfig } from "../types";

interface QrThumbnailProps {
  config: Partial<QrConfig>;
  size?: number;
  className?: string;
  data?: string;
}

export function QrThumbnail({
  config,
  size = 64,
  className = "",
  data = "https://github.com/konnn04",
}: QrThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const dots = config.dots;
    const cornersSquare = config.cornersSquare;
    const cornersDot = config.cornersDot;
    const background = config.background;

    const qrOptions: Options = {
      width: size,
      height: size,
      type: "svg",
      data,
      margin: 2,
      qrOptions: {
        typeNumber: 0,
        errorCorrectionLevel: "M",
      },
      dotsOptions: {
        type: dots?.type || "rounded",
        color: dots?.color || "#000000",
        gradient:
          dots?.useGradient && dots.gradient && dots.gradient.type !== "none" && dots.gradient.colorStops?.length
            ? {
                type: dots.gradient.type,
                rotation: ((dots.gradient.rotation || 0) * Math.PI) / 180,
                colorStops: dots.gradient.colorStops,
              }
            : undefined,
      },
      cornersSquareOptions: {
        type: cornersSquare?.type === "dot" ? "extra-rounded" : cornersSquare?.type || "extra-rounded",
        color: cornersSquare?.useCustomColor ? cornersSquare.color : dots?.color || "#000000",
      },
      cornersDotOptions: {
        type: cornersDot?.type || "dot",
        color: cornersDot?.useCustomColor ? cornersDot.color : dots?.color || "#000000",
      },
      backgroundOptions: {
        color: background?.transparent ? "transparent" : background?.color || "#ffffff",
      },
    };

    try {
      const qr = new QRCodeStyling(qrOptions);
      qr.append(containerRef.current);
    } catch {
      /* ignore render errors in thumb */
    }
  }, [config, size, data]);

  return (
    <div
      ref={containerRef}
      className={`qrg-thumb-container ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: config.background?.color || "#ffffff",
      }}
    />
  );
}
