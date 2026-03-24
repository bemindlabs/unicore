import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import '@bemindlabs/unicore-ui/globals.css';

export default async function WizardLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('wizard');

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg mb-3">
            U
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t('setupTitle')}</h1>
          <p className="text-muted-foreground">{t('setupSubtitle')}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
