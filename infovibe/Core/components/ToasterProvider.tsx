"use client";

import { Toaster } from "react-hot-toast";

export default function ToasterProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        className: "panel dark:bg-slate-800 dark:text-white border-0 !shadow-lg",
        style: {
          background: "var(--toast-bg, #fff)",
          color: "var(--toast-color, #09111f)",
          borderRadius: "0.75rem",
          padding: "1rem"
        },
        success: {
          iconTheme: {
            primary: "#047857",
            secondary: "#fff"
          }
        },
        error: {
          iconTheme: {
            primary: "#e02424",
            secondary: "#fff"
          }
        }
      }}
    />
  );
}
