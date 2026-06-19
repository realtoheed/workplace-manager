import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#09090b",
        cloud: "#f8fafc",
        mist: "#94a3b8",
        brand: "#0284c7",
        secondary: "#60a5fa",
        night: "#09090b",
        success: "#10b981",
        danger: "#ef4444"
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "Inter", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        panel: "0 24px 80px rgba(0, 0, 0, 0.5)",
        soft: "0 18px 40px rgba(0, 0, 0, 0.3)"
      },
      backgroundImage: {
        mesh: "radial-gradient(circle at top left, rgba(2, 132, 199, 0.15), transparent 40%), radial-gradient(circle at bottom right, rgba(96, 165, 250, 0.1), transparent 30%)"
      }
    }
  },
  plugins: []
};

export default config;