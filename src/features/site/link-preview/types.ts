export interface LinkMetadata {
  url: string;
  originalUrl: string;
  title: string;
  description: string;
  siteName: string;
  image: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  favicon: string;
  author?: string;
  publishedTime?: string;
  type?: string;
  locale?: string;
  themeColor?: string;
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  twitterSite?: string;
  twitterCreator?: string;
  canonical?: string;
  robots?: string;
  keywords?: string[];
}

export type ScoreCategory = "seo" | "opengraph" | "twitter" | "assets";

export type AuditStatus = "pass" | "warn" | "fail";

export interface ScoreItem {
  id: string;
  category: ScoreCategory;
  titleKey: string;
  descKey: string;
  weight: number;
  score: number;
  status: AuditStatus;
  actualValue?: string;
  recommendationKey: string;
}

export interface AuditResult {
  totalScore: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  passCount: number;
  warnCount: number;
  failCount: number;
  items: ScoreItem[];
  categoryScores: Record<ScoreCategory, { earned: number; total: number }>;
}


export type PlatformId =
  | "all"
  | "google"
  | "twitter"
  | "facebook"
  | "discord"
  | "whatsapp"
  | "linkedin"
  | "telegram";
