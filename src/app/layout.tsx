import type { Metadata } from 'next';
import './globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import Navbar from '@/components/ui/Navbar';

import { ThemeProvider } from '@/components/providers/ThemeProvider';

export const metadata: Metadata = {
  title: 'Digital Cemetery System',
  icons: {
    icon: '/dcs-favicon.svg',
    shortcut: '/dcs-favicon.svg',
    apple: '/dcs-favicon.png',
  },
  description: 'Современная система цифровизации и управления кладбищами',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col font-sans antialiased bg-[color:var(--bg)] text-[color:var(--ink)]">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Navbar />
          <main className="flex-grow flex flex-col pt-16 hover:bg-transparent">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
