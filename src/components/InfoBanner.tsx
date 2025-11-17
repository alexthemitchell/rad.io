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
  const variantStyles: React.CSSProperties = {
    padding: "16px",
    borderLeft: "4px solid",
    marginBottom: "16px",
    borderRadius: "4px",
    ...(variant === "info"
      ? {
          backgroundColor: "var(--rad-info-bg)",
          borderColor: "var(--rad-info-border)",
        }
      : {
          backgroundColor: "var(--rad-advanced-bg)",
          borderColor: "var(--rad-advanced-border)",
        }),
    ...style,
  };

  const titleStyles: React.CSSProperties = {
    marginTop: 0,
    fontSize: "16px",
    fontWeight: 600,
    ...(variant === "info"
      ? { color: "var(--rad-info-fg)" }
      : { color: "var(--rad-advanced-fg)" }),
  };

  const contentStyles: React.CSSProperties = {
    marginBottom: 0,
  };

  return (
    <div
      className={`info-banner info-banner--${variant} ${className}`}
      style={variantStyles}
      role={role}
      aria-live={role === "status" ? ariaLive : undefined}
    >
      {title && <h3 style={titleStyles}>{title}</h3>}
      <div style={contentStyles}>{children}</div>
    </div>
  );
}
