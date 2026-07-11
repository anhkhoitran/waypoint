import type { ButtonHTMLAttributes, CSSProperties } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const variants: Record<Variant, CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: 'var(--accent-contrast)',
    border: '1px solid transparent',
  },
  secondary: {
    background: 'var(--surface-raised)',
    color: 'var(--text)',
    border: '1px solid var(--border-strong)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid transparent',
  },
};

export function Button({
  variant = 'primary',
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 13.5,
        fontWeight: 550,
        cursor: 'pointer',
        transition: 'filter 120ms ease, background 120ms ease',
        ...variants[variant],
        ...style,
      }}
    />
  );
}
