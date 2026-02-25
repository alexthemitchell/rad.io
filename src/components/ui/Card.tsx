import type { ReactNode } from 'react';

interface CardProps {
  className?: string;
  title?: string;
  children: ReactNode;
}

export function Card({ className, title, children }: CardProps) {
  const classes = ['ui-card', className].filter(Boolean).join(' ');

  return (
    <section className={classes}>
      {title ? <h3 className="ui-card-title">{title}</h3> : null}
      {children}
    </section>
  );
}
