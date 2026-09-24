import type { QrConfig } from "../types";

export const DEFAULT_QR_CONFIG: QrConfig = {
  type: "url",
  rawText: "https://github.com/konnn04/konnns-extension",
  wifi: {
    ssid: "",
    password: "",
    encryption: "WPA",
    hidden: false,
  },
  vcard: {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    company: "",
    job: "",
    website: "",
    address: "",
  },
  email: {
    email: "",
    subject: "",
    body: "",
  },
  phone: "",
  sms: {
    phone: "",
    message: "",
  },
  whatsapp: {
    phone: "",
    message: "",
  },
  event: {
    title: "",
    start: "",
    end: "",
    location: "",
    description: "",
  },
  geo: {
    latitude: "21.0285",
    longitude: "105.8542",
  },
  crypto: {
    coin: "BTC",
    address: "",
    amount: "",
  },

  dots: {
    type: "rounded",
    color: "#2563eb",
    useGradient: true,
    gradient: {
      type: "linear",
      rotation: 45,
      colorStops: [
        { offset: 0, color: "#2563eb" },
        { offset: 1, color: "#06b6d4" },
      ],
    },
  },
  cornersSquare: {
    type: "extra-rounded",
    color: "#1d4ed8",
    useCustomColor: false,
  },
  cornersDot: {
    type: "dot",
    color: "#0891b2",
    useCustomColor: false,
  },
  background: {
    color: "#ffffff",
    transparent: false,
  },
  logo: {
    url: undefined,
    size: 0.28,
    margin: 4,
    clearBackground: true,
  },
  frame: {
    type: "none",
    text: "SCAN ME",
    color: "#2563eb",
    textColor: "#ffffff",
  },
  options: {
    errorCorrectionLevel: "Q",
    margin: 2,
  },
};

export interface StylePreset {
  id: string;
  nameKey: string;
  config: Partial<QrConfig>;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "classic",
    nameKey: "qr.presets.classic",
    config: {
      dots: {
        type: "square",
        color: "#000000",
        useGradient: false,
        gradient: { type: "none", rotation: 0, colorStops: [] },
      },
      cornersSquare: { type: "square", color: "#000000", useCustomColor: false },
      cornersDot: { type: "square", color: "#000000", useCustomColor: false },
      background: { color: "#ffffff", transparent: false },
    },
  },
  {
    id: "modern-blue",
    nameKey: "qr.presets.modernBlue",
    config: {
      dots: {
        type: "rounded",
        color: "#2563eb",
        useGradient: true,
        gradient: {
          type: "linear",
          rotation: 45,
          colorStops: [
            { offset: 0, color: "#2563eb" },
            { offset: 1, color: "#06b6d4" },
          ],
        },
      },
      cornersSquare: { type: "extra-rounded", color: "#1d4ed8", useCustomColor: false },
      cornersDot: { type: "dot", color: "#0891b2", useCustomColor: false },
      background: { color: "#ffffff", transparent: false },
    },
  },
  {
    id: "sunset-glow",
    nameKey: "qr.presets.sunset",
    config: {
      dots: {
        type: "classy",
        color: "#f43f5e",
        useGradient: true,
        gradient: {
          type: "linear",
          rotation: 30,
          colorStops: [
            { offset: 0, color: "#f43f5e" },
            { offset: 1, color: "#8b5cf6" },
          ],
        },
      },
      cornersSquare: { type: "extra-rounded", color: "#e11d48", useCustomColor: true },
      cornersDot: { type: "dot", color: "#7c3aed", useCustomColor: true },
      background: { color: "#ffffff", transparent: false },
    },
  },
  {
    id: "emerald-mint",
    nameKey: "qr.presets.emerald",
    config: {
      dots: {
        type: "dots",
        color: "#059669",
        useGradient: true,
        gradient: {
          type: "linear",
          rotation: 60,
          colorStops: [
            { offset: 0, color: "#059669" },
            { offset: 1, color: "#10b981" },
          ],
        },
      },
      cornersSquare: { type: "extra-rounded", color: "#047857", useCustomColor: false },
      cornersDot: { type: "dot", color: "#059669", useCustomColor: false },
      background: { color: "#ffffff", transparent: false },
    },
  },
  {
    id: "luxury-gold",
    nameKey: "qr.presets.luxuryGold",
    config: {
      dots: {
        type: "classy-rounded",
        color: "#d97706",
        useGradient: true,
        gradient: {
          type: "linear",
          rotation: 45,
          colorStops: [
            { offset: 0, color: "#b45309" },
            { offset: 1, color: "#f59e0b" },
          ],
        },
      },
      cornersSquare: { type: "extra-rounded", color: "#b45309", useCustomColor: true },
      cornersDot: { type: "square", color: "#d97706", useCustomColor: true },
      background: { color: "#18181b", transparent: false },
    },
  },
  {
    id: "cyber-neon",
    nameKey: "qr.presets.cyberNeon",
    config: {
      dots: {
        type: "extra-rounded",
        color: "#06b6d4",
        useGradient: true,
        gradient: {
          type: "linear",
          rotation: 135,
          colorStops: [
            { offset: 0, color: "#06b6d4" },
            { offset: 1, color: "#d946ef" },
          ],
        },
      },
      cornersSquare: { type: "square", color: "#06b6d4", useCustomColor: true },
      cornersDot: { type: "dot", color: "#d946ef", useCustomColor: true },
      background: { color: "#0f172a", transparent: false },
    },
  },
];

export interface PresetLogo {
  id: string;
  name: string;
  nameKey?: string;
  svgDataUri: string;
}

export const PRESET_LOGOS: PresetLogo[] = [
  {
    id: "web",
    name: "Website",
    nameKey: "qr.logos.web",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%232563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
  },
  {
    id: "wifi",
    name: "Wi-Fi",
    nameKey: "qr.logos.wifi",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13a10 10 0 0 1 14 0"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 20 0"/><line x1="12" x2="12.01" y1="20" y2="20"/></svg>`,
  },
  {
    id: "facebook",
    name: "Facebook",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%231877f2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  },
  {
    id: "youtube",
    name: "YouTube",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ff0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  },
  {
    id: "zalo",
    name: "Zalo",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="%230068ff"/><text x="50%" y="58%" font-size="16" font-weight="bold" fill="white" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle">Zalo</text></svg>`,
  },
  {
    id: "telegram",
    name: "Telegram",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23229ED9"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.56 8.16l-1.92 9.07c-.14.65-.53.81-1.07.51l-2.96-2.18-1.43 1.38c-.16.16-.29.29-.6.29l.21-3.03 5.52-4.99c.24-.21-.05-.33-.37-.12l-6.82 4.29-2.94-.92c-.64-.2-.65-.64.13-.95l11.5-4.43c.53-.2 1 .12.88.97z"/></svg>`,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2325D366"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24z"/></svg>`,
  },
  {
    id: "phone",
    name: "Phone",
    nameKey: "qr.logos.phone",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2310b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  },
  {
    id: "email",
    name: "Email",
    nameKey: "qr.logos.email",
    svgDataUri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  },
];
