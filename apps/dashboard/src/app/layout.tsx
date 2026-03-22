import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/components/providers';
import '@unicore/ui/globals.css';

export const metadata: Metadata = {
  title: 'UniCore Dashboard',
  description: 'AI-powered business operations dashboard',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('selected-theme');if(!s){var c=localStorage.getItem('character-theme');if(c)s=c;else{var t=localStorage.getItem('theme');s=t||'default'}}var d=s==='dark'||s==='retrodesk'||s==='crypto'?true:s==='light'?false:window.matchMedia('(prefers-color-scheme:dark)').matches;if(d)document.documentElement.classList.add('dark');var ct=s;var skin=localStorage.getItem('character-skin');if(skin&&(skin.startsWith('retrodesk')||skin.startsWith('crypto')))ct=skin;if(ct&&(ct.startsWith('retrodesk')||ct.startsWith('crypto')))document.documentElement.setAttribute('data-character-theme',ct)}catch(e){}})()`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
