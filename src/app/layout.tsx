import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import Navbar from '@/components/ui/Navbar';

import { ThemeProvider } from '@/components/providers/ThemeProvider';

const inter = Inter({ subsets: ['cyrillic', 'latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Digital Cemetery System',
  description: 'Современная система цифровизации и управления кладбищами',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50 min-h-screen flex flex-col`}>
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
