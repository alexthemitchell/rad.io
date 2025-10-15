import { ReactNode } from "react";

type CardProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

function Card({ title, subtitle, children }: CardProps) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {subtitle && <div className="card-subtitle">{subtitle}</div>}
      {children}
    </div>
  );
}

export default Card;
