"use client";

import Link from "next/link";
import { type MouseEvent as ReactMouseEvent, useEffect } from "react";
import { usePathname } from "next/navigation";
import { canManageClientMeetings, canManageDepartments, canManageMeetings, canManageSalary as canManageSalaryRole, canManageUsers, formatRoleLabel } from "@/lib/roles";
import type { SessionUser } from "@/lib/types";

type NavigationItem = {
  href: string;
  label: string;
  newTab?: boolean;
  windowFeatures?: string;
};

type SidebarProps = {
  user: SessionUser;
  isExpanded: boolean;
  onOpen: () => void;
  onClose: () => void;
};

function canManageSalary(user: SessionUser): boolean {
  return canManageSalaryRole(user.role);
}

function renderIcon(href: string, baseClass: string): React.ReactNode {
  if (href === "/admin" || href === "/dashboard") {
    return (
      <svg className={baseClass} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 3H10V10H3V3ZM14 3H21V7H14V3ZM14 10H21V21H14V10ZM3 14H10V21H3V14Z" fill="currentColor" />
      </svg>
    );
  }

  if (href.includes("employees")) {
    return (
      <svg className={baseClass} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 11C17.6569 11 19 9.65685 19 8C19 6.34315 17.6569 5 16 5C14.3431 5 13 6.34315 13 8C13 9.65685 14.3431 11 16 11Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 12C10.2091 12 12 10.2091 12 8C12 5.79086 10.2091 4 8 4C5.79086 4 4 5.79086 4 8C4 10.2091 5.79086 12 8 12Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M2.5 19C2.5 16.7909 4.29086 15 6.5 15H9.5C11.7091 15 13.5 16.7909 13.5 19" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M13.5 18.5C13.5 16.8431 14.8431 15.5 16.5 15.5H18C19.6569 15.5 21 16.8431 21 18.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (href.includes("departments")) {
    return (
      <svg className={baseClass} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (href.includes("meetings") || href === "/meeting") {
    return (
      <svg className={baseClass} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.8" width="14" x="3" y="6" />
        <path d="M17 10L21 8V16L17 14V10Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (href === "/attendance") {
    return (
      <svg className={baseClass} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 6v6l4 2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (href.includes("salary")) {
    return (
      <svg className={baseClass} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2Z" fill="currentColor" />
        <path d="M19 7H5C4.4 7 4 7.4 4 8V9C4 9.6 4.4 10 5 10V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V10C19.6 10 20 9.6 20 9V8C20 7.4 19.6 7 19 7Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 11V19" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 11V19" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 11V19" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (href === "/recordings") {
    return (
      <svg className={baseClass} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg className={baseClass} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function Sidebar({ user, isExpanded, onOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  function handleNavigationClick(event: ReactMouseEvent<HTMLAnchorElement>, link: NavigationItem) {
    if (!link.newTab || !link.windowFeatures || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const openedWindow = window.open(link.href, "_blank", link.windowFeatures);
    if (!openedWindow) return;
    event.preventDefault();
    openedWindow.opener = null;
  }

  const isTL = user.role === "team_lead";
  const isAdmin = user.role === "super_admin";
  const isHR = user.role === "hr";
  const isEmployee = user.role === "employee";

  let links: NavigationItem[];

  if (isEmployee) {
    links = [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/attendance", label: "Attendance History" },
      { href: "/recordings", label: "Recordings" },
    ];
  } else if (isTL) {
    links = [
      { href: "/dashboard/team-lead", label: "Overview" },
      ...(canManageClientMeetings(user.role) ? [{ href: "/admin/client-meetings", label: "Client Meetings" } as NavigationItem] : []),
      { href: "/attendance", label: "Department Attendance" },
      { href: "/recordings", label: "Recordings" },
    ];
  } else {
    links = [
      { href: "/admin", label: "Overview" },
      ...(canManageUsers(user.role) ? [{ href: "/admin/employees", label: "Employees Management" } as NavigationItem] : []),
      ...(canManageDepartments(user.role) ? [{ href: "/admin/departments", label: "Departments" } as NavigationItem] : []),
      ...(canManageMeetings(user.role) ? [{ href: "/admin/meetings", label: "Meetings" } as NavigationItem] : []),
      ...(canManageClientMeetings(user.role) ? [{ href: "/admin/client-meetings", label: "Client Meetings" } as NavigationItem] : []),
      { href: "/attendance", label: "Attendance History" },
      ...(canManageSalary(user) ? [{ href: "/admin/salary", label: "Salary Management" } as NavigationItem] : []),
      { href: "/recordings", label: "Recordings" },
    ];
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-300 lg:hidden ${isExpanded ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white text-slate-700 transition-[width] duration-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 ${
          isExpanded ? "w-72" : "w-[4.75rem]"
        } lg:translate-x-0 ${isExpanded ? "translate-x-0" : "-translate-x-full"}`}
        onMouseEnter={onOpen}
        onMouseLeave={onClose}
      >
        <div className="flex h-14 items-center justify-center border-b border-slate-200 px-3 dark:border-slate-800">
          <span className={`text-sm font-bold tracking-tight transition-opacity ${isExpanded ? "opacity-100" : "opacity-0 hidden"}`}>
            InfoVibeX
          </span>
          <span className={`text-lg font-bold text-blue-600 ${isExpanded ? "hidden" : "block"}`}>
            I
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-1">
            {links.map((link) => {
              const isActive = link.href === "/admin" || link.href === "/dashboard" || link.href === "/dashboard/team-lead"
                ? pathname === link.href
                : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white"
                    }`}
                    href={link.href}
                    onClick={(e) => handleNavigationClick(e, link)}
                    {...(link.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      {renderIcon(link.href, "h-5 w-5")}
                    </span>
                    <span className={`whitespace-nowrap transition-opacity ${isExpanded ? "opacity-100" : "hidden opacity-0"}`}>
                      {link.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${isExpanded ? "" : "justify-center"}`}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <div className={`min-w-0 transition-opacity ${isExpanded ? "opacity-100" : "hidden opacity-0"}`}>
              <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-200">{user.name}</p>
              <p className="truncate text-[10px] text-slate-500">{formatRoleLabel(user.role)}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}