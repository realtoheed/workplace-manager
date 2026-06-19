"use client";

export default function DesktopTitlebar() {
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex h-7 items-center bg-slate-950 px-3 select-none border-b border-slate-800">
      <span className="text-[11px] font-medium text-slate-400 tracking-wide">
        InfoVibeX Task Manager
      </span>
    </div>
  );
}
