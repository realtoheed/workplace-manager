"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { formatRoleLabel } from "@/lib/roles";
import type { SessionUser } from "@/lib/types";

type NavbarProps = {
  pageTitle?: string;
  description?: string;
  user: SessionUser;
  isSidebarExpanded?: boolean;
};

type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
};

const DEFAULT_DESKTOP_APP_DOWNLOAD_URL = "/downloads/InfoVibeX-Setup.exe";

function isDesktopShellRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  const runtimeWindow = window as Window & {
    infovibeDesktop?: unknown;
  };

  return Boolean(runtimeWindow.infovibeDesktop) || /\belectron\//i.test(window.navigator.userAgent);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getUserInitials(value: string) {
  return String(value || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
}

export default function Navbar({ pageTitle, description, user, isSidebarExpanded }: NavbarProps) {
  const router = useRouter();

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const notificationPanelId = "navbar-notification-panel";
  const [isDesktopShell, setIsDesktopShell] = useState<boolean | null>(null);
  const [darkMode, setDarkMode] = useState(() => typeof window !== "undefined" && document.documentElement.classList.contains("dark"));
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);
  const desktopAppDownloadUrl = DEFAULT_DESKTOP_APP_DOWNLOAD_URL;

  function handleOpenMeeting(event: ReactMouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.open("/meeting?closeOnLeave=1", "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    setIsDesktopShell(isDesktopShellRuntime());
  }, []);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      try {
        const response = await fetch("/api/notifications", {
          cache: "no-store"
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load notifications.");
        }

        if (!active) {
          return;
        }

        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
        setNotificationError(null);
      } catch (error) {
        if (!active) {
          return;
        }

        setNotificationError(error instanceof Error ? error.message : "Unable to load notifications.");
      }
    }

    void loadNotifications();
    const interval = setInterval(() => {
      void loadNotifications();
    }, 8000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Node;

      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNotificationOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleOpenNotification(notification: NotificationItem) {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ notificationId: notification.id })
      });
    } catch {
      // Ignore mark-read errors so navigation still works.
    }

    setNotifications((current) => current.filter((entry) => entry.id !== notification.id));
    setUnreadCount((current) => Math.max(0, current - 1));
    setNotificationOpen(false);
    router.push(notification.href);
  }

  useEffect(() => {
    if (!notifications.length) return;
    const latest = notifications[0];
    if (lastNotificationId === latest.id) return;
    setLastNotificationId(latest.id);

    // Request permission if not already granted
    if (window.Notification && Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    // Show browser notification
    if (window.Notification && Notification.permission === "granted") {
      new Notification(latest.title || "New Notification", {
        body: latest.body || "You have a new notification.",
        icon: "/favicon.ico",
        tag: latest.id,
      });
    }
  }, [lastNotificationId, notifications]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
    // Optionally persist theme
    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme", darkMode ? "dark" : "light");
    }
  }, [darkMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("theme");
      if (saved === "dark") setDarkMode(true);
      if (saved === "light") setDarkMode(false);
    }
  }, []);

  useEffect(() => {
    const controlNavbar = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setIsHidden(true);
      } else if (currentScrollY < lastScrollY.current) {
        setIsHidden(false);
      }
      lastScrollY.current = currentScrollY;
    };

    if (typeof window !== "undefined") {
      window.addEventListener("scroll", controlNavbar);
      return () => {
        window.removeEventListener("scroll", controlNavbar);
      };
    }
  }, []);

  return (
    <header className="z-20 rounded-xl border border-slate-200 bg-white/80 px-3 py-3 shadow-sm backdrop-blur-md transition-all duration-300 dark:border-white/[0.08] dark:bg-[#09090b]/70 sm:px-4">
      <nav aria-label="Global navigation" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand/80 dark:text-secondary/80">by InfoVibeX</p>
          <h1 className="mt-0.5 truncate font-display text-base font-bold text-ink dark:text-white sm:text-xl" id={pageTitle ? "page-title" : undefined}>
            {pageTitle || "Core TaskManager"}
          </h1>
          {description ? <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300 sm:text-sm">{description}</p> : null}
        </div>
        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <div className="relative" ref={notificationRef}>
            <button
              aria-controls={notificationPanelId}
              aria-expanded={notificationOpen}
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              className="button-secondary relative h-10 w-10 px-0 hover:text-brand"
              onClick={() => setNotificationOpen((current) => !current)}
              type="button"
            >
              <svg fill="none" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 3C8.68629 3 6 5.68629 6 9V12.5858L4.29289 14.2929C3.90237 14.6834 4.17895 15.35 4.73223 15.35H19.2678C19.821 15.35 20.0976 14.6834 19.7071 14.2929L18 12.5858V9C18 5.68629 15.3137 3 12 3Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path d="M9.5 18C9.96584 19.1652 10.8748 20 12 20C13.1252 20 14.0342 19.1652 14.5 18" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-danger px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white dark:text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>

            {notificationOpen ? (
              <div
                className="absolute right-0 top-full z-[9999] mt-2 w-[320px] max-w-[95vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#111113]"
                id={notificationPanelId}
                role="region"
              >
                <div className="border-b border-slate-200 px-4 py-3 dark:border-white/[0.07]">
                  <p className="text-sm font-semibold text-ink dark:text-white">Notifications</p>
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  {notificationError ? <p className="px-4 py-3 text-sm text-danger dark:text-danger">{notificationError}</p> : null}

                  {!notificationError && !notifications.length ? (
                    <p className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">No notifications yet.</p>
                  ) : null}

                  {notifications.map((notification) => (
                    <button
                      className="block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 dark:border-white/[0.07] dark:hover:bg-white/[0.05]"
                      key={notification.id}
                      onClick={() => handleOpenNotification(notification)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink dark:text-white">{notification.title}</p>
                        <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{notification.kind}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">{notification.body}</p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{formatDateTime(notification.createdAt)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <Link className="button-primary h-10 px-3 sm:px-4" href="/meeting?closeOnLeave=1" onClick={handleOpenMeeting}>
            Join Meeting
          </Link>
          <button
            className="button-secondary h-10 w-10 px-0"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
            title="Logout"
            type="button"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
}