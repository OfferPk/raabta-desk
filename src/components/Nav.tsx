"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/board", label: "Board" },
  { href: "/follow-ups", label: "Follow-ups" },
  { href: "/imports", label: "Ads Drop" },
  { href: "/leads/new", label: "New lead" },
];

type NavLink = (typeof LINKS)[number];

function isActiveLink(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/leads") {
    return pathname.startsWith("/leads/") && pathname !== "/leads/new";
  }
  return pathname.startsWith(`${href}/`);
}

export function Nav({
  user,
}: {
  user: { name: string; role: string; email: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const links: NavLink[] =
    user.role === "owner"
      ? [...LINKS, { href: "/users", label: "Team" }]
      : LINKS;
  const initials = user.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  function linkClass(href: string, mobile = false) {
    const active = isActiveLink(pathname, href);
    if (mobile) {
      return `flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-medium transition ${
        active
          ? "bg-teal-50 text-teal-800"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`;
    }
    return `rounded-xl px-3 py-2 text-[13px] font-medium transition ${
      active
        ? "bg-teal-50 text-teal-800 shadow-sm ring-1 ring-teal-100"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-[0_2px_12px_rgba(15,23,42,0.03)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-5 lg:px-8">
        <div className="flex min-w-0 items-center gap-4 lg:gap-7">
          <Link
            href="/dashboard"
            className="group flex shrink-0 items-center gap-2.5 rounded-xl"
            aria-label="Raabta Desk home"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-800 text-base font-bold text-white shadow-sm shadow-teal-900/15 transition group-hover:bg-teal-900">
              R
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-bold tracking-tight text-slate-900">
                Raabta Desk
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Sales workspace
              </span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActiveLink(pathname, link.href) ? "page" : undefined}
                className={linkClass(link.href)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {user.role === "owner" && (
            <a
              href="/api/export/leads.csv"
              className="btn-secondary hidden !rounded-xl !px-3 !py-2 text-xs sm:inline-flex"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 2.75v9m0 0 3.25-3.25M10 11.75 6.75 8.5M3.5 12.75v2.5A1.75 1.75 0 0 0 5.25 17h9.5a1.75 1.75 0 0 0 1.75-1.75v-2.5" />
              </svg>
              Export
            </a>
          )}

          <div className="hidden items-center gap-2.5 border-l border-slate-200 pl-3 sm:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-800 ring-1 ring-teal-100">
              {initials || "U"}
            </span>
            <span className="max-w-32 leading-tight">
              <span className="block truncate text-xs font-semibold text-slate-800">
                {user.name}
              </span>
              <span className="mt-0.5 block text-[10px] capitalize text-slate-500">
                {user.role}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            disabled={busy}
            className="btn-secondary !rounded-xl !px-3 !py-2 text-xs"
          >
            {busy ? "Signing out…" : "Log out"}
          </button>

          <button
            type="button"
            className="btn-secondary !h-10 !w-10 !rounded-xl !p-0 md:hidden"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" d="m5 5 10 10M15 5 5 15" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" d="M3 5.5h14M3 10h14M3 14.5h14" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="border-t border-slate-100 bg-white px-3 py-3 md:hidden sm:px-5"
        >
          <div className="mx-auto grid max-w-7xl gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActiveLink(pathname, link.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={linkClass(link.href, true)}
              >
                {link.label}
                {isActiveLink(pathname, link.href) && (
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                )}
              </Link>
            ))}
            {user.role === "owner" && (
              <a
                href="/api/export/leads.csv"
                className="rounded-xl px-3.5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Export leads as CSV
              </a>
            )}
            <div className="mt-2 flex items-center gap-3 border-t border-slate-100 px-3.5 pt-3 sm:hidden">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-800 ring-1 ring-teal-100">
                {initials || "U"}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-800">{user.name}</span>
                <span className="text-xs capitalize text-slate-500">{user.role}</span>
              </span>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
