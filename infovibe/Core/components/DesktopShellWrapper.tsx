"use client";

import { useEffect, useState } from "react";
import DesktopTitlebar from "@/components/DesktopTitlebar";

export default function DesktopShellWrapper({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("desktopShell") === "1") {
      setIsDesktop(true);
    }
  }, []);

  if (!isDesktop) return <>{children}</>;

  return (
    <>
      <DesktopTitlebar />
      <div className="pt-7">{children}</div>
    </>
  );
}
