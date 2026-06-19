"use client";

import type { SessionUser } from "@/lib/types";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { useCallback, useState } from "react";

type PlatformShellProps = {
  user: SessionUser;
  title?: string;
  description?: string;
  children: React.ReactNode;
};

export default function PlatformShell({ user, title, description, children }: PlatformShellProps) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const handleOpenSidebar = useCallback(() => {
    setIsSidebarExpanded(true);
  }, []);
  const handleCloseSidebar = useCallback(() => {
    setIsSidebarExpanded(false);
  }, []);

  const sidebarWidth = isSidebarExpanded ? "18rem" : "4.75rem";

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-slate-900 dark:text-white">
      <Sidebar user={user} isExpanded={isSidebarExpanded} onClose={handleCloseSidebar} onOpen={handleOpenSidebar} />
      <div
        className="flex min-h-screen flex-col"
        style={{
          marginLeft: sidebarWidth,
          transition: "margin-left 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div className="sticky top-0 z-20 px-3 pt-3 sm:px-4 sm:pt-4">
          <Navbar description={description} pageTitle={title} user={user} isSidebarExpanded={isSidebarExpanded} />
        </div>
        <main
          aria-labelledby={title ? "page-title" : undefined}
          className="flex-1 px-3 pb-8 pt-3 sm:px-4 sm:pt-4"
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}