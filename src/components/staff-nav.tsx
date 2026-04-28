"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items: Array<{ href: Route; label: string }> = [
  { href: "/staff/audit", label: "Approve Hours" },
  { href: "/staff/stores", label: "Stores" },
  { href: "/staff/id-pool", label: "Codes" }
];

export function StaffNav() {
  const pathname = usePathname();

  return (
    <nav className="staff-nav" aria-label="Staff navigation">
      {items.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("staff-tab", isActive && "staff-tab-active")}
          >
            <strong>{item.label}</strong>
          </Link>
        );
      })}
    </nav>
  );
}
