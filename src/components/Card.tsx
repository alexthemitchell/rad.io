import { ReactNode } from "react";

type CardProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

function Card({ title, subtitle, children }: CardProps) {
  return (
    <section className="card" aria-labelledby={`card-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <h2 id={`card-title-${title.replace(/\s+/g, '-').toLowerCase()}`} className="card-title">{title}</h2>
      {subtitle && <p className="card-subtitle">{subtitle}</p>}
      {children}
    </section>
  );
}

export default Card;
