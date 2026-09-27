import type { AuditResult, LinkMetadata, ScoreCategory, ScoreItem } from "../types";

export function evaluateMetadata(data: LinkMetadata): AuditResult {
  const items: ScoreItem[] = [];

  const titleLen = data.title.trim().length;
  if (titleLen === 0) {
    items.push({
      id: "title",
      category: "seo",
      titleKey: "linkPreview.score.title.name",
      descKey: "linkPreview.score.title.desc",
      weight: 10,
      score: 0,
      status: "fail",
      actualValue: "0 characters",
      recommendationKey: "linkPreview.score.title.missing",
    });
  } else if (titleLen < 25 || titleLen > 65) {
    items.push({
      id: "title",
      category: "seo",
      titleKey: "linkPreview.score.title.name",
      descKey: "linkPreview.score.title.desc",
      weight: 10,
      score: 6,
      status: "warn",
      actualValue: `${titleLen} characters`,
      recommendationKey: titleLen < 25 ? "linkPreview.score.title.tooShort" : "linkPreview.score.title.tooLong",
    });
  } else {
    items.push({
      id: "title",
      category: "seo",
      titleKey: "linkPreview.score.title.name",
      descKey: "linkPreview.score.title.desc",
      weight: 10,
      score: 10,
      status: "pass",
      actualValue: `${titleLen} characters`,
      recommendationKey: "linkPreview.score.title.optimal",
    });
  }

  const descLen = data.description.trim().length;
  if (descLen === 0) {
    items.push({
      id: "desc",
      category: "seo",
      titleKey: "linkPreview.score.desc.name",
      descKey: "linkPreview.score.desc.desc",
      weight: 10,
      score: 0,
      status: "fail",
      actualValue: "0 characters",
      recommendationKey: "linkPreview.score.desc.missing",
    });
  } else if (descLen < 50 || descLen > 165) {
    items.push({
      id: "desc",
      category: "seo",
      titleKey: "linkPreview.score.desc.name",
      descKey: "linkPreview.score.desc.desc",
      weight: 10,
      score: 6,
      status: "warn",
      actualValue: `${descLen} characters`,
      recommendationKey: descLen < 50 ? "linkPreview.score.desc.tooShort" : "linkPreview.score.desc.tooLong",
    });
  } else {
    items.push({
      id: "desc",
      category: "seo",
      titleKey: "linkPreview.score.desc.name",
      descKey: "linkPreview.score.desc.desc",
      weight: 10,
      score: 10,
      status: "pass",
      actualValue: `${descLen} characters`,
      recommendationKey: "linkPreview.score.desc.optimal",
    });
  }

  const hasCanonical = Boolean(data.canonical && data.canonical.trim());
  items.push({
    id: "canonical",
    category: "seo",
    titleKey: "linkPreview.score.canonical.name",
    descKey: "linkPreview.score.canonical.desc",
    weight: 5,
    score: hasCanonical ? 5 : 2,
    status: hasCanonical ? "pass" : "warn",
    actualValue: hasCanonical ? data.canonical : undefined,
    recommendationKey: hasCanonical ? "linkPreview.score.canonical.ok" : "linkPreview.score.canonical.missing",
  });

  const hasFavicon = Boolean(data.favicon && data.favicon.trim());
  items.push({
    id: "favicon",
    category: "seo",
    titleKey: "linkPreview.score.favicon.name",
    descKey: "linkPreview.score.favicon.desc",
    weight: 5,
    score: hasFavicon ? 5 : 2,
    status: hasFavicon ? "pass" : "warn",
    actualValue: hasFavicon ? data.favicon : undefined,
    recommendationKey: hasFavicon ? "linkPreview.score.favicon.ok" : "linkPreview.score.favicon.missing",
  });

  const hasOgTitle = Boolean(data.title && data.title.trim());
  items.push({
    id: "og_title",
    category: "opengraph",
    titleKey: "linkPreview.score.ogTitle.name",
    descKey: "linkPreview.score.ogTitle.desc",
    weight: 8,
    score: hasOgTitle ? 8 : 0,
    status: hasOgTitle ? "pass" : "fail",
    actualValue: data.title || undefined,
    recommendationKey: hasOgTitle ? "linkPreview.score.ogTitle.ok" : "linkPreview.score.ogTitle.missing",
  });

  const hasOgDesc = Boolean(data.description && data.description.trim());
  items.push({
    id: "og_desc",
    category: "opengraph",
    titleKey: "linkPreview.score.ogDesc.name",
    descKey: "linkPreview.score.ogDesc.desc",
    weight: 7,
    score: hasOgDesc ? 7 : 0,
    status: hasOgDesc ? "pass" : "fail",
    actualValue: data.description ? `${data.description.slice(0, 50)}…` : undefined,
    recommendationKey: hasOgDesc ? "linkPreview.score.ogDesc.ok" : "linkPreview.score.ogDesc.missing",
  });

  const hasImage = Boolean(data.image && data.image.trim());
  const isHttps = hasImage && data.image.startsWith("https://");
  if (!hasImage) {
    items.push({
      id: "og_image",
      category: "opengraph",
      titleKey: "linkPreview.score.ogImage.name",
      descKey: "linkPreview.score.ogImage.desc",
      weight: 12,
      score: 0,
      status: "fail",
      actualValue: undefined,
      recommendationKey: "linkPreview.score.ogImage.missing",
    });
  } else if (!isHttps) {
    items.push({
      id: "og_image",
      category: "opengraph",
      titleKey: "linkPreview.score.ogImage.name",
      descKey: "linkPreview.score.ogImage.desc",
      weight: 12,
      score: 7,
      status: "warn",
      actualValue: data.image,
      recommendationKey: "linkPreview.score.ogImage.httpWarning",
    });
  } else {
    items.push({
      id: "og_image",
      category: "opengraph",
      titleKey: "linkPreview.score.ogImage.name",
      descKey: "linkPreview.score.ogImage.desc",
      weight: 12,
      score: 12,
      status: "pass",
      actualValue: data.image,
      recommendationKey: "linkPreview.score.ogImage.ok",
    });
  }

  const hasOgUrl = Boolean(data.url && data.url.trim());
  items.push({
    id: "og_url",
    category: "opengraph",
    titleKey: "linkPreview.score.ogUrl.name",
    descKey: "linkPreview.score.ogUrl.desc",
    weight: 4,
    score: hasOgUrl ? 4 : 0,
    status: hasOgUrl ? "pass" : "warn",
    actualValue: data.url || undefined,
    recommendationKey: hasOgUrl ? "linkPreview.score.ogUrl.ok" : "linkPreview.score.ogUrl.missing",
  });

  const hasOgSiteName = Boolean(data.siteName && data.siteName.trim());
  items.push({
    id: "og_site_name",
    category: "opengraph",
    titleKey: "linkPreview.score.ogSiteName.name",
    descKey: "linkPreview.score.ogSiteName.desc",
    weight: 4,
    score: hasOgSiteName ? 4 : 1,
    status: hasOgSiteName ? "pass" : "warn",
    actualValue: data.siteName || undefined,
    recommendationKey: hasOgSiteName ? "linkPreview.score.ogSiteName.ok" : "linkPreview.score.ogSiteName.missing",
  });

  const hasTwitterCard = Boolean(data.twitterCard);
  items.push({
    id: "twitter_card",
    category: "twitter",
    titleKey: "linkPreview.score.twitterCard.name",
    descKey: "linkPreview.score.twitterCard.desc",
    weight: 8,
    score: hasTwitterCard ? 8 : 3,
    status: hasTwitterCard ? "pass" : "warn",
    actualValue: data.twitterCard || undefined,
    recommendationKey: hasTwitterCard ? "linkPreview.score.twitterCard.ok" : "linkPreview.score.twitterCard.missing",
  });

  const hasTwitterTitle = Boolean(data.title && data.title.trim());
  items.push({
    id: "twitter_title",
    category: "twitter",
    titleKey: "linkPreview.score.twitterTitle.name",
    descKey: "linkPreview.score.twitterTitle.desc",
    weight: 4,
    score: hasTwitterTitle ? 4 : 0,
    status: hasTwitterTitle ? "pass" : "warn",
    actualValue: data.title || undefined,
    recommendationKey: hasTwitterTitle ? "linkPreview.score.twitterTitle.ok" : "linkPreview.score.twitterTitle.missing",
  });

  const hasTwitterDesc = Boolean(data.description && data.description.trim());
  items.push({
    id: "twitter_desc",
    category: "twitter",
    titleKey: "linkPreview.score.twitterDesc.name",
    descKey: "linkPreview.score.twitterDesc.desc",
    weight: 4,
    score: hasTwitterDesc ? 4 : 0,
    status: hasTwitterDesc ? "pass" : "warn",
    actualValue: data.description ? `${data.description.slice(0, 50)}…` : undefined,
    recommendationKey: hasTwitterDesc ? "linkPreview.score.twitterDesc.ok" : "linkPreview.score.twitterDesc.missing",
  });

  const hasTwitterImg = Boolean(data.image && data.image.trim());
  items.push({
    id: "twitter_image",
    category: "twitter",
    titleKey: "linkPreview.score.twitterImage.name",
    descKey: "linkPreview.score.twitterImage.desc",
    weight: 4,
    score: hasTwitterImg ? 4 : 0,
    status: hasTwitterImg ? "pass" : "warn",
    actualValue: data.image || undefined,
    recommendationKey: hasTwitterImg ? "linkPreview.score.twitterImage.ok" : "linkPreview.score.twitterImage.missing",
  });

  const hasThemeColor = Boolean(data.themeColor && data.themeColor.trim());
  items.push({
    id: "theme_color",
    category: "assets",
    titleKey: "linkPreview.score.themeColor.name",
    descKey: "linkPreview.score.themeColor.desc",
    weight: 5,
    score: hasThemeColor ? 5 : 2,
    status: hasThemeColor ? "pass" : "warn",
    actualValue: data.themeColor || undefined,
    recommendationKey: hasThemeColor ? "linkPreview.score.themeColor.ok" : "linkPreview.score.themeColor.missing",
  });

  const hasType = Boolean(data.type && data.type.trim());
  items.push({
    id: "og_type",
    category: "assets",
    titleKey: "linkPreview.score.ogType.name",
    descKey: "linkPreview.score.ogType.desc",
    weight: 5,
    score: hasType ? 5 : 2,
    status: hasType ? "pass" : "warn",
    actualValue: data.type || undefined,
    recommendationKey: hasType ? "linkPreview.score.ogType.ok" : "linkPreview.score.ogType.missing",
  });

  let imgRatioScore = 2;
  let imgRatioStatus: "pass" | "warn" | "fail" = "warn";
  let imgRatioRec = "linkPreview.score.imageRatio.unknown";
  if (data.imageWidth && data.imageHeight) {
    const ratio = data.imageWidth / data.imageHeight;
    const isOptimalRatio = ratio >= 1.7 && ratio <= 2.1;
    const isHighRes = data.imageWidth >= 1200 && data.imageHeight >= 630;
    if (isOptimalRatio && isHighRes) {
      imgRatioScore = 5;
      imgRatioStatus = "pass";
      imgRatioRec = "linkPreview.score.imageRatio.optimal";
    } else if (isOptimalRatio) {
      imgRatioScore = 4;
      imgRatioStatus = "pass";
      imgRatioRec = "linkPreview.score.imageRatio.goodRatioLowRes";
    } else {
      imgRatioScore = 3;
      imgRatioStatus = "warn";
      imgRatioRec = "linkPreview.score.imageRatio.suboptimalRatio";
    }
  } else if (hasImage) {
    imgRatioScore = 4;
    imgRatioStatus = "pass";
    imgRatioRec = "linkPreview.score.imageRatio.present";
  } else {
    imgRatioScore = 0;
    imgRatioStatus = "fail";
    imgRatioRec = "linkPreview.score.imageRatio.missing";
  }

  items.push({
    id: "image_ratio",
    category: "assets",
    titleKey: "linkPreview.score.imageRatio.name",
    descKey: "linkPreview.score.imageRatio.desc",
    weight: 5,
    score: imgRatioScore,
    status: imgRatioStatus,
    actualValue:
      data.imageWidth && data.imageHeight
        ? `${data.imageWidth}×${data.imageHeight} (${(data.imageWidth / data.imageHeight).toFixed(2)}:1)`
        : undefined,
    recommendationKey: imgRatioRec,
  });

  let totalScore = 0;
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  const categoryScores: Record<ScoreCategory, { earned: number; total: number }> = {
    seo: { earned: 0, total: 0 },
    opengraph: { earned: 0, total: 0 },
    twitter: { earned: 0, total: 0 },
    assets: { earned: 0, total: 0 },
  };

  for (const item of items) {
    totalScore += item.score;
    categoryScores[item.category].earned += item.score;
    categoryScores[item.category].total += item.weight;

    if (item.status === "pass") passCount++;
    else if (item.status === "warn") warnCount++;
    else failCount++;
  }

  let grade: AuditResult["grade"] = "F";
  if (totalScore >= 95) grade = "A+";
  else if (totalScore >= 85) grade = "A";
  else if (totalScore >= 70) grade = "B";
  else if (totalScore >= 55) grade = "C";
  else if (totalScore >= 40) grade = "D";

  return {
    totalScore,
    grade,
    passCount,
    warnCount,
    failCount,
    items,
    categoryScores,
  };
}
