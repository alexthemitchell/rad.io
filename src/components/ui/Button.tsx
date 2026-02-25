import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'start' | 'stop' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  start: 'btn-start',
  stop: 'btn-stop',
  secondary: 'btn-secondary'
};

export function Button({ variant = 'secondary', className, children, ...props }: ButtonProps) {
  const classes = ['action-btn', variantClass[variant], className].filter(Boolean).join(' ');
  return (
    <button {...props} className={classes}>
      {children}
    </button>
  );
}
