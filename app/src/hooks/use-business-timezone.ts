'use client';

import { useEffect, useState } from 'react';

const DEFAULT_TIMEZONE = 'America/New_York';
let cachedTimezone: string | null = null;

/**
 * Hook that returns the configured business timezone from settings.
 * Fetches once from /api/v1/settings/wizard-status and caches in memory.
 */
export function useBusinessTimezone(): string {
  const [timezone, setTimezone] = useState(cachedTimezone ?? DEFAULT_TIMEZONE);

  useEffect(() => {
    if (cachedTimezone) return;

    fetch('/api/v1/settings/wizard-status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.timezone) {
          cachedTimezone = data.timezone;
          setTimezone(data.timezone);
        }
      })
      .catch(() => {
        // Fallback to default
      });
  }, []);

  return timezone;
}

/** Format an ISO date string as a localized date in the given timezone. */
export function formatDateTz(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  }).format(new Date(iso));
}

/** Format an ISO date string as a localized date+time in the given timezone. */
export function formatDateTimeTz(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

/** Format an ISO date string as 12-hour time (e.g. "2:30 PM") in the given timezone. */
export function formatTimeTz(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}
