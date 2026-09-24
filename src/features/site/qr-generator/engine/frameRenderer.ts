import type { QrConfig } from "../types";

export function renderFramedCanvas(
  qrCanvas: HTMLCanvasElement,
  config: QrConfig,
  targetSize = 1000,
): HTMLCanvasElement {
  const frame = config.frame;
  if (!frame || frame.type === "none") {
    // If no frame, just scale qrCanvas to targetSize
    const out = document.createElement("canvas");
    out.width = targetSize;
    out.height = targetSize;
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(qrCanvas, 0, 0, targetSize, targetSize);
    return out;
  }

  const out = document.createElement("canvas");
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const qrRatio = 0.8;
  const qrSize = Math.round(targetSize * qrRatio);
  const marginX = Math.round((targetSize - qrSize) / 2);

  // Background of the frame container
  const bgColor = config.background.transparent ? "#ffffff" : config.background.color || "#ffffff";
  const frameColor = frame.color || "#2563eb";
  const textColor = frame.textColor || "#ffffff";
  const text = (frame.text || "SCAN ME").toUpperCase();

  if (frame.type === "bottom") {
    const bannerHeight = Math.round(targetSize * 0.16);
    const totalHeight = targetSize + bannerHeight;
    out.width = targetSize;
    out.height = totalHeight;

    // Draw outer card
    roundRect(ctx, 0, 0, targetSize, totalHeight, 28);
    ctx.fillStyle = bgColor;
    ctx.fill();

    // Border around card
    ctx.lineWidth = 12;
    ctx.strokeStyle = frameColor;
    ctx.stroke();

    // Draw QR in center
    const qrY = Math.round((targetSize - qrSize) / 2);
    ctx.drawImage(qrCanvas, marginX, qrY, qrSize, qrSize);

    // Draw bottom banner
    const bannerY = targetSize - 8;
    const bannerW = targetSize - 40;
    const bannerX = 20;
    const bannerH = bannerHeight - 12;
    roundRect(ctx, bannerX, bannerY, bannerW, bannerH, 16);
    ctx.fillStyle = frameColor;
    ctx.fill();

    // Text in banner
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(bannerH * 0.44)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, targetSize / 2, bannerY + bannerH / 2);

    return out;
  }

  if (frame.type === "top") {
    const bannerHeight = Math.round(targetSize * 0.16);
    const totalHeight = targetSize + bannerHeight;
    out.width = targetSize;
    out.height = totalHeight;

    // Draw outer card
    roundRect(ctx, 0, 0, targetSize, totalHeight, 28);
    ctx.fillStyle = bgColor;
    ctx.fill();

    ctx.lineWidth = 12;
    ctx.strokeStyle = frameColor;
    ctx.stroke();

    // Draw top banner
    const bannerX = 20;
    const bannerY = 20;
    const bannerW = targetSize - 40;
    const bannerH = bannerHeight - 12;
    roundRect(ctx, bannerX, bannerY, bannerW, bannerH, 16);
    ctx.fillStyle = frameColor;
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(bannerH * 0.44)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, targetSize / 2, bannerY + bannerH / 2);

    // Draw QR
    const qrY = bannerHeight + Math.round((targetSize - qrSize) / 2) - 10;
    ctx.drawImage(qrCanvas, marginX, qrY, qrSize, qrSize);

    return out;
  }

  if (frame.type === "phone") {
    const topNotch = Math.round(targetSize * 0.1);
    const bottomPill = Math.round(targetSize * 0.14);
    const totalHeight = targetSize + topNotch + bottomPill;
    out.width = targetSize;
    out.height = totalHeight;

    // Phone body
    roundRect(ctx, 8, 8, targetSize - 16, totalHeight - 16, 48);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.lineWidth = 16;
    ctx.strokeStyle = frameColor;
    ctx.stroke();

    // Top speaker notch
    const notchW = Math.round(targetSize * 0.22);
    const notchH = 12;
    roundRect(ctx, (targetSize - notchW) / 2, 32, notchW, notchH, 6);
    ctx.fillStyle = frameColor;
    ctx.fill();

    // QR Code
    const qrY = topNotch + Math.round((targetSize - qrSize) / 2);
    ctx.drawImage(qrCanvas, marginX, qrY, qrSize, qrSize);

    // Bottom label or home bar
    ctx.fillStyle = frameColor;
    ctx.font = `bold ${Math.round(targetSize * 0.045)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, targetSize / 2, totalHeight - bottomPill / 2);

    return out;
  }

  if (frame.type === "badge") {
    const pad = Math.round(targetSize * 0.1);
    const totalW = targetSize + pad * 2;
    const totalH = targetSize + pad * 2 + 50;
    out.width = totalW;
    out.height = totalH;

    // Outer card
    roundRect(ctx, 10, 10, totalW - 20, totalH - 20, 36);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = frameColor;
    ctx.stroke();

    // QR Code
    ctx.drawImage(qrCanvas, pad, pad, targetSize, targetSize);

    // Pill badge at bottom
    const badgeW = Math.round(totalW * 0.7);
    const badgeH = 54;
    const badgeX = (totalW - badgeW) / 2;
    const badgeY = totalH - 64;
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 27);
    ctx.fillStyle = frameColor;
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = `bold 22px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, totalW / 2, badgeY + badgeH / 2);

    return out;
  }

  return qrCanvas;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** Composites framed SVG string with frame and QR for SVG vector export */
export function renderFramedSvg(qrSvgString: string, config: QrConfig, size = 1000): string {
  const frame = config.frame;
  if (!frame || frame.type === "none") {
    return qrSvgString;
  }

  const bgColor = config.background.transparent ? "#ffffff" : config.background.color || "#ffffff";
  const frameColor = frame.color || "#2563eb";
  const textColor = frame.textColor || "#ffffff";
  const text = (frame.text || "SCAN ME").toUpperCase();

  // Extract inner svg content or strip outer <svg>
  const innerMatch = qrSvgString.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  const innerContent = innerMatch ? innerMatch[1] : qrSvgString;

  const qrRatio = 0.8;
  const qrSize = Math.round(size * qrRatio);
  const marginX = Math.round((size - qrSize) / 2);

  if (frame.type === "bottom") {
    const bannerHeight = Math.round(size * 0.16);
    const totalHeight = size + bannerHeight;
    const bannerY = size - 8;
    const bannerW = size - 40;
    const bannerH = bannerHeight - 12;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${totalHeight}" width="${size}" height="${totalHeight}">
      <rect width="${size}" height="${totalHeight}" rx="28" fill="${bgColor}" stroke="${frameColor}" stroke-width="12"/>
      <g transform="translate(${marginX}, ${marginX}) scale(${qrRatio})">
        ${innerContent}
      </g>
      <rect x="20" y="${bannerY}" width="${bannerW}" height="${bannerH}" rx="16" fill="${frameColor}"/>
      <text x="${size / 2}" y="${bannerY + bannerH / 2 + 7}" fill="${textColor}" font-family="system-ui, sans-serif" font-weight="bold" font-size="${Math.round(bannerH * 0.44)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>
    </svg>`;
  }

  if (frame.type === "top") {
    const bannerHeight = Math.round(size * 0.16);
    const totalHeight = size + bannerHeight;
    const bannerH = bannerHeight - 12;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${totalHeight}" width="${size}" height="${totalHeight}">
      <rect width="${size}" height="${totalHeight}" rx="28" fill="${bgColor}" stroke="${frameColor}" stroke-width="12"/>
      <rect x="20" y="20" width="${size - 40}" height="${bannerH}" rx="16" fill="${frameColor}"/>
      <text x="${size / 2}" y="${20 + bannerH / 2 + 7}" fill="${textColor}" font-family="system-ui, sans-serif" font-weight="bold" font-size="${Math.round(bannerH * 0.44)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>
      <g transform="translate(${marginX}, ${bannerHeight + marginX - 10}) scale(${qrRatio})">
        ${innerContent}
      </g>
    </svg>`;
  }

  return qrSvgString;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}
