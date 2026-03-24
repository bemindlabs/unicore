'use client';

import { useLocale as useNextIntlLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';

export function useLocale() {
  const locale = useNextIntlLocale() as Locale;
  const router = useRouter();

  function setLocale(newLocale: Locale) {
    document.cookie = `locale=${newLocale};path=/;samesite=lax;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return { locale, setLocale };
}
