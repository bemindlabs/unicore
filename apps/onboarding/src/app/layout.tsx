import '@unicore/ui/globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'UniCore — AI-First Ecosystem for Solopreneurs',
  description:
    'Replace dozens of SaaS tools with a single AI-driven platform. Automate workflows, manage operations, and deploy AI agents so your small team operates like a full company.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-gray-50 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
