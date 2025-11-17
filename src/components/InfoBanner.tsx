/**
 * InfoBanner Component
 *
 * A reusable banner for displaying contextual information to users.
 * Supports two variants: "info" (blue, beginner-friendly) and "advanced" (purple, expert).
 *
 * Accessibility:
 * - Uses role="status" with aria-live="polite" for dynamic content
 * - Uses role="note" for static content
 * - High contrast colors from design tokens
 *
 * Styles are defined in src/styles/components/info-banner.css
 */

import React from "react";

export type InfoBannerVariant = "info" | "advanced";

export interface InfoBannerProps {
  /** Visual variant - "info" for blue theme, "advanced" for purple theme */
  variant?: InfoBannerVariant;
  /** Banner title (optional) */
  title?: string;
  /** Banner content */
  children: React.ReactNode;
  /** ARIA role - "status" for dynamic/dismissible content, "note" for static */
  role?: "status" | "note";
  /** ARIA live region politeness (only applies when role="status") */
  ariaLive?: "polite" | "assertive";
  /** Additional CSS class names */
  className?: string;
  /** Additional inline styles (use sparingly) */
  style?: React.CSSProperties;
}

/**
 * InfoBanner component for contextual help and information
 */
export function InfoBanner({
  variant = "info",
  title,
  children,
  role = "status",
  ariaLive = "polite",
  className = "",
  style = {},
}: InfoBannerProps): React.JSX.Element {
  const classes = ["info-banner", `info-banner--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={style}
      role={role}
      aria-live={role === "status" ? ariaLive : undefined}
    >
      {title && <h3 className="info-banner__title">{title}</h3>}
      <div className="info-banner__content">{children}</div>
    </div>
  );
}
