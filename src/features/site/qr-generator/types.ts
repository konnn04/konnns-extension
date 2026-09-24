export type DataType =
  | "url"
  | "text"
  | "wifi"
  | "vcard"
  | "email"
  | "phone"
  | "sms"
  | "whatsapp"
  | "event"
  | "geo"
  | "crypto";

export type DotType =
  | "dots"
  | "rounded"
  | "classy"
  | "classy-rounded"
  | "square"
  | "extra-rounded";

export type CornerSquareType = "dot" | "square" | "extra-rounded";
export type CornerDotType = "dot" | "square";
export type GradientType = "none" | "linear" | "radial";
export type FrameType = "none" | "bottom" | "top" | "badge" | "phone";
export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export interface WifiData {
  ssid: string;
  password: string;
  encryption: "WPA" | "WEP" | "nopass";
  hidden: boolean;
}

export interface VCardData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company: string;
  job: string;
  website: string;
  address: string;
}

export interface EmailData {
  email: string;
  subject: string;
  body: string;
}

export interface SmsData {
  phone: string;
  message: string;
}

export interface WhatsappData {
  phone: string;
  message: string;
}

export interface EventData {
  title: string;
  start: string;
  end: string;
  location: string;
  description: string;
}

export interface GeoData {
  latitude: string;
  longitude: string;
}

export interface CryptoData {
  coin: "BTC" | "ETH" | "USDT" | "SOL" | "BNB";
  address: string;
  amount: string;
}

export interface GradientConfig {
  type: GradientType;
  rotation: number;
  colorStops: Array<{ offset: number; color: string }>;
}

export interface QrConfig {
  type: DataType;
  rawText: string;
  wifi: WifiData;
  vcard: VCardData;
  email: EmailData;
  phone: string;
  sms: SmsData;
  whatsapp: WhatsappData;
  event: EventData;
  geo: GeoData;
  crypto: CryptoData;

  dots: {
    type: DotType;
    color: string;
    useGradient: boolean;
    gradient: GradientConfig;
  };
  cornersSquare: {
    type: CornerSquareType;
    color: string;
    useCustomColor: boolean;
  };
  cornersDot: {
    type: CornerDotType;
    color: string;
    useCustomColor: boolean;
  };
  background: {
    color: string;
    transparent: boolean;
  };
  logo: {
    url?: string;
    size: number;
    margin: number;
    clearBackground: boolean;
  };
  frame: {
    type: FrameType;
    text: string;
    color: string;
    textColor: string;
  };
  options: {
    errorCorrectionLevel: ErrorCorrectionLevel;
    margin: number;
  };
}
