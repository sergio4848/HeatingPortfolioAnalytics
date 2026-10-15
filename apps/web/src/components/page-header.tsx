import type { ReactNode } from "react";
export const Title = ({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) => (
  <header className="page-head">
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="muted">{subtitle}</p>
    </div>
    <div className="actions">{children}</div>
  </header>
);
