import type {
  CryptoData,
  EmailData,
  EventData,
  GeoData,
  QrConfig,
  SmsData,
  VCardData,
  WifiData,
} from "../types";

export function encodeWifi(data: WifiData): string {
  const enc = data.encryption || "WPA";
  const hidden = data.hidden ? "true" : "false";
  // Escape special characters in SSID and password: \ ; , : "
  const escapeStr = (s: string) => s.replace(/([\\;,:"'])/g, "\\$1");
  return `WIFI:T:${enc};S:${escapeStr(data.ssid)};P:${escapeStr(data.password)};H:${hidden};;`;
}

export function encodeVCard(data: VCardData): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${data.lastName || ""};${data.firstName || ""};;;`,
    `FN:${[data.firstName, data.lastName].filter(Boolean).join(" ")}`,
  ];
  if (data.company) lines.push(`ORG:${data.company}`);
  if (data.job) lines.push(`TITLE:${data.job}`);
  if (data.phone) lines.push(`TEL;TYPE=CELL:${data.phone}`);
  if (data.email) lines.push(`EMAIL:${data.email}`);
  if (data.website) lines.push(`URL:${data.website}`);
  if (data.address) lines.push(`ADR:;;${data.address};;;;`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

export function encodeEmail(data: EmailData): string {
  const parts: string[] = [];
  if (data.subject) parts.push(`subject=${encodeURIComponent(data.subject)}`);
  if (data.body) parts.push(`body=${encodeURIComponent(data.body)}`);
  const query = parts.length > 0 ? `?${parts.join("&")}` : "";
  return `mailto:${data.email || ""}${query}`;
}

export function encodeSms(data: SmsData): string {
  const phone = data.phone || "";
  const msg = data.message ? `:${data.message}` : "";
  return `SMSTO:${phone}${msg}`;
}

export function encodeWhatsapp(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^0-9+]/g, "");
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${cleanPhone}${query}`;
}

export function encodeEvent(data: EventData): string {
  const formatDate = (iso: string) => {
    if (!iso) return "";
    return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };
  const lines = [
    "BEGIN:VEVENT",
    `SUMMARY:${data.title || "Event"}`,
    data.start ? `DTSTART:${formatDate(data.start)}` : "",
    data.end ? `DTEND:${formatDate(data.end)}` : "",
    data.location ? `LOCATION:${data.location}` : "",
    data.description ? `DESCRIPTION:${data.description}` : "",
    "END:VEVENT",
  ].filter(Boolean);
  return lines.join("\n");
}

export function encodeGeo(data: GeoData): string {
  const lat = data.latitude || "0";
  const lng = data.longitude || "0";
  return `geo:${lat},${lng}?q=${lat},${lng}`;
}

export function encodeCrypto(data: CryptoData): string {
  const coin = (data.coin || "BTC").toLowerCase();
  const address = data.address || "";
  const amount = data.amount ? `?amount=${data.amount}` : "";
  return `${coin}:${address}${amount}`;
}

export function buildQrPayload(config: QrConfig): string {
  switch (config.type) {
    case "url": {
      const raw = config.rawText.trim();
      if (!raw) return "https://";
      if (!/^https?:\/\//i.test(raw)) return `https://${raw}`;
      return raw;
    }
    case "text":
      return config.rawText.trim() || "QR Code";
    case "wifi":
      return encodeWifi(config.wifi);
    case "vcard":
      return encodeVCard(config.vcard);
    case "email":
      return encodeEmail(config.email);
    case "phone":
      return config.phone ? `tel:${config.phone.trim()}` : "";
    case "sms":
      return encodeSms(config.sms);
    case "whatsapp":
      return encodeWhatsapp(config.whatsapp.phone, config.whatsapp.message);
    case "event":
      return encodeEvent(config.event);
    case "geo":
      return encodeGeo(config.geo);
    case "crypto":
      return encodeCrypto(config.crypto);
    default:
      return config.rawText || "";
  }
}

/**
 * Convert a JS string to a "byte string" where each char is one UTF-8 byte.
 *
 * qr-code-styling (via qrcode-generator) in Byte mode treats each JS char as
 * a single byte. Non-Latin characters like Vietnamese diacritics are multi-byte
 * in UTF-8, so passing them directly produces garbled QR data. This encodes
 * the string as UTF-8 bytes and maps each byte back to a single char, giving
 * the library the raw UTF-8 sequence it needs.
 */
export function utf8ByteString(str: string): string {
  if (!str) return "";
  // Fast path: if all characters are ASCII, no encoding needed. The control
  // range is deliberate here — this is a byte-range test, not a text pattern,
  // which is the case the rule exists to catch.
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7f]*$/.test(str)) return str;
  const bytes = new TextEncoder().encode(str);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

