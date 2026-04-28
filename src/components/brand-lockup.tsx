import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";

type BrandLockupProps = {
  href?: Route;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export function BrandLockup({
  href = "/",
  eyebrow = "Falcon Farms",
  title = "FieldOps",
  subtitle,
  compact = false
}: BrandLockupProps) {
  const content = (
    <div className={`brand-lockup${compact ? " brand-lockup-compact" : ""}`}>
      <div className="brand-logo-shell">
        <Image src="/falcon-symbol.png" alt="Falcon Farms logo" width={56} height={56} priority />
      </div>
      <div className="brand-lockup-copy">
        <span className="brand-lockup-eyebrow">{eyebrow}</span>
        <strong>{title}</strong>
        {subtitle ? <span className="brand-lockup-subtitle">{subtitle}</span> : null}
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
