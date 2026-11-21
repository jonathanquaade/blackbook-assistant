import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blackbook · Good people. Great work.",
  description:
    "A private creative network. Explore the work, find your people, and curate with care. Interactive sandbox preview.",
  robots: { index: false, follow: false },
};

const themeScript = `(function(){try{var t=localStorage.getItem('blackbook-theme');document.documentElement.dataset.theme=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <WorkspaceProvider>
          <Shell>{children}</Shell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
