import Link from 'next/link';
import type { ReactNode } from 'react';

interface CardProps {
  href?: string;
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
}

export function Card({ href, title, icon, children }: CardProps) {
  const inner = (
    <div className="group relative flex flex-col gap-2 rounded-lg border bg-fd-card p-4 text-fd-card-foreground transition-colors hover:bg-fd-accent/80 hover:border-fd-primary/30">
      {icon && <div className="text-fd-muted-foreground">{icon}</div>}
      <h3 className="font-semibold text-sm">{title}</h3>
      {children && (
        <div className="text-sm text-fd-muted-foreground">{children}</div>
      )}
    </div>
  );

  if (!href) return inner;

  if (href.startsWith('http') || href.startsWith('mailto:')) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return <Link href={href}>{inner}</Link>;
}

export function Cards({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 not-prose">
      {children}
    </div>
  );
}
