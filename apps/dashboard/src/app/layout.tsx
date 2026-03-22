import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/components/providers';
import '@unicore/ui/globals.css';

export const metadata: Metadata = {
  title: 'UniCore Dashboard',
  description: 'AI-powered business operations dashboard',
};

const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('selected-theme');if(!s){var c=localStorage.getItem('character-theme');if(c)s=c;else{var t=localStorage.getItem('theme');s=t||'default'}}var d=s==='dark'||s==='retrodesk'||s==='crypto'?true:s==='light'?false:window.matchMedia('(prefers-color-scheme:dark)').matches;if(d)document.documentElement.classList.add('dark');if(s==='retrodesk'||s==='crypto')document.documentElement.setAttribute('data-character-theme',s)}catch(e){}})()`;

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
