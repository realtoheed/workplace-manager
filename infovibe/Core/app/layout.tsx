import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import ToasterProvider from "@/components/ToasterProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk"
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans"
});

export const metadata: Metadata = {
  title: "TaskManager | by InfoVibeX",
  description: "TaskManager by InfoVibeX for internal meetings, tasks, attendance, and team collaboration."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`dark ${spaceGrotesk.variable} ${ibmPlexSans.variable} antialiased`} suppressHydrationWarning>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark');document.body.classList.remove('dark');}else{document.documentElement.classList.add('dark');document.body.classList.add('dark');}})();`
          }}
        />
        <ToasterProvider />
        {children}
      </body>
    </html>
  );
}
