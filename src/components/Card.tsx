import { type ReactNode, useState } from "react";

type CardProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
};

function Card({
  title,
  subtitle,
  children,
  collapsible = false,
  defaultExpanded = true,
}: CardProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const cardId = `card-title-${title.replace(/\s+/g, "-").toLowerCase()}`;

  const toggleExpanded = (): void => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <section className="card" aria-labelledby={cardId}>
      <div
        className={`card-header ${collapsible ? "card-header-collapsible" : ""}`}
        onClick={toggleExpanded}
        onKeyDown={(e) => {
          if (collapsible && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            toggleExpanded();
          }
        }}
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? isExpanded : undefined}
        aria-controls={collapsible ? `${cardId}-content` : undefined}
      >
        <div>
          <h2 id={cardId} className="card-title">
            {title}
          </h2>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
        {collapsible && (
          <span className="card-collapse-icon" aria-hidden="true">
            {isExpanded ? "▼" : "▶"}
          </span>
        )}
      </div>
      {isExpanded && (
        <div
          id={`${cardId}-content`}
          className="card-content"
          role={collapsible ? "region" : undefined}
        >
          {children}
        </div>
      )}
    </section>
  );
}

export default Card;
