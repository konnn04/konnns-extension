import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  XCircle,
} from "lucide-react";
import type { AuditResult, AuditStatus, ScoreCategory } from "../types";
import { Button } from "@/shared/ui";

interface ScorecardProps {
  audit: AuditResult;
  onOpenExportModal?: () => void;
}

export function Scorecard({ audit, onOpenExportModal }: ScorecardProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<"all" | "issues" | "pass">(
    audit.warnCount + audit.failCount > 0 ? "issues" : "all",
  );
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const filteredItems = audit.items.filter((item) => {
    if (filter === "issues") return item.status !== "pass";
    if (filter === "pass") return item.status === "pass";
    return true;
  });

  const getStatusIcon = (status: AuditStatus) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 size={15} className="lp-status-icon lp-status-icon--pass" />;
      case "warn":
        return <AlertTriangle size={15} className="lp-status-icon lp-status-icon--warn" />;
      case "fail":
        return <XCircle size={15} className="lp-status-icon lp-status-icon--fail" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "var(--accent, #38bdf8)";
    if (score >= 70) return "#10b981";
    if (score >= 55) return "#f59e0b";
    return "#ef4444";
  };

  const categories: Array<{ id: ScoreCategory; labelKey: string }> = [
    { id: "seo", labelKey: "linkPreview.categories.seo" },
    { id: "opengraph", labelKey: "linkPreview.categories.opengraph" },
    { id: "twitter", labelKey: "linkPreview.categories.twitter" },
    { id: "assets", labelKey: "linkPreview.categories.assets" },
  ];

  const issuesCount = audit.warnCount + audit.failCount;

  return (
    <div className="lp-score-compact">
      <div className="lp-score-compact__header">
        <div className="lp-score-compact__score-badge" style={{ borderColor: getScoreColor(audit.totalScore) }}>
          <span className="lp-score-compact__score-val" style={{ color: getScoreColor(audit.totalScore) }}>
            {audit.totalScore}
          </span>
          <span className="lp-score-compact__score-max">/100</span>
          <span className="lp-score-compact__grade" style={{ backgroundColor: getScoreColor(audit.totalScore) }}>
            {audit.grade}
          </span>
        </div>

        <div className="lp-score-compact__heading">
          <h4 className="lp-score-compact__title">{t("linkPreview.scorecardTitle")}</h4>
          <div className="lp-score-compact__stats-inline">
            <span className="lp-stat-chip lp-stat-chip--pass">✓ {audit.passCount} {t("linkPreview.stats.passed")}</span>
            {audit.warnCount > 0 && (
              <span className="lp-stat-chip lp-stat-chip--warn">⚠ {audit.warnCount} {t("linkPreview.stats.warnings")}</span>
            )}
            {audit.failCount > 0 && (
              <span className="lp-stat-chip lp-stat-chip--fail">✕ {audit.failCount} {t("linkPreview.stats.failures")}</span>
            )}
          </div>
        </div>

        <div className="lp-score-compact__header-actions">
          {onOpenExportModal && (
            <Button size="sm" variant="subtle" onClick={onOpenExportModal} title={t("linkPreview.exportTags")}>
              <Code2 size={14} />
            </Button>
          )}
          <Button
            size="sm"
            variant={isExpanded ? "subtle" : "ghost"}
            onClick={() => setIsExpanded((v) => !v)}
            className="lp-score-toggle-btn"
          >
            <span>{isExpanded ? t("linkPreview.hideDetails") : t("linkPreview.showDetails")}</span>
            {!isExpanded && issuesCount > 0 && (
              <span className="lp-score-issues-badge">{issuesCount}</span>
            )}
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
      </div>

      <div className="lp-score-compact__cats-row">
        {categories.map((cat) => {
          const catScore = audit.categoryScores[cat.id];
          const pct = Math.round((catScore.earned / catScore.total) * 100) || 0;
          return (
            <div key={cat.id} className="lp-score-compact__cat-col">
              <div className="lp-score-compact__cat-label">
                <span>{t(cat.labelKey)}</span>
                <span className="lp-score-compact__cat-num">{catScore.earned}/{catScore.total}</span>
              </div>
              <div className="lp-score-compact__cat-track">
                <div
                  className="lp-score-compact__cat-fill"
                  style={{ width: `${pct}%`, backgroundColor: getScoreColor(pct) }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {isExpanded && (
        <div className="lp-score-compact__details">
          <div className="lp-score-compact__filter-bar">
            <div className="lp-score-compact__filter-tabs">
              <button
                type="button"
                className={`lp-score-tab ${filter === "issues" ? "lp-score-tab--active" : ""}`}
                onClick={() => setFilter("issues")}
              >
                {t("linkPreview.filter.issues")} ({audit.warnCount + audit.failCount})
              </button>
              <button
                type="button"
                className={`lp-score-tab ${filter === "all" ? "lp-score-tab--active" : ""}`}
                onClick={() => setFilter("all")}
              >
                {t("linkPreview.filter.all")} ({audit.items.length})
              </button>
              <button
                type="button"
                className={`lp-score-tab ${filter === "pass" ? "lp-score-tab--active" : ""}`}
                onClick={() => setFilter("pass")}
              >
                {t("linkPreview.filter.passed")} ({audit.passCount})
              </button>
            </div>
          </div>

          <div className="lp-score-compact__items-list">
            {filteredItems.length === 0 ? (
              <p className="lp-score-compact__empty">
                {filter === "issues" ? "Tất cả các tiêu chí đều đạt chuẩn tối ưu! 🎉" : "Không có mục nào."}
              </p>
            ) : (
              filteredItems.map((item) => {
                const isItemExpanded = expandedItemId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`lp-compact-item lp-compact-item--${item.status}`}
                  >
                    <button
                      type="button"
                      className="lp-compact-item__header"
                      onClick={() => setExpandedItemId(isItemExpanded ? null : item.id)}
                    >
                      <div className="lp-compact-item__left">
                        {getStatusIcon(item.status)}
                        <span className="lp-compact-item__name">{t(item.titleKey)}</span>
                        {item.actualValue && (
                          <span className="lp-compact-item__badge">{item.actualValue}</span>
                        )}
                      </div>
                      <div className="lp-compact-item__right">
                        <span className="lp-compact-item__pts">
                          {item.score}/{item.weight}đ
                        </span>
                        {isItemExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>

                    {isItemExpanded && (
                      <div className="lp-compact-item__body">
                        <p className="lp-compact-item__desc">{t(item.descKey)}</p>
                        <div className="lp-compact-item__rec">
                          <strong>Gợi ý:</strong> {t(item.recommendationKey)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
