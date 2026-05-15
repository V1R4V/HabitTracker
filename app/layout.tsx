import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Habit Command Center",
  description: "Private habit, task, planning, scoring, and analytics dashboard.",
};

const themeScript = `
(() => {
  try {
    const saved = window.localStorage.getItem("hcc-theme");
    document.documentElement.dataset.theme = saved || "dark";
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
