import { useCallback } from "react";

/**
 * Format a currency amount using Intl.NumberFormat.
 *
 * @param amount  - Value to format (number, string, null, or undefined).
 * @param currency - ISO 4217 currency code (default "USD").
 * @param locale   - BCP 47 locale string (default "en-US").
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency = "USD",
  locale = "en-US",
): string {
  const n = Number(amount);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(Number.isFinite(n) ? n : 0);
}

/**
 * React hook that returns a memoised currency formatter.
 *
 * @param options.currency - Default currency code.
 * @param options.locale   - Default locale string.
 */
export function useFormatCurrency(
  options: { currency?: string; locale?: string } = {},
) {
  const { currency = "USD", locale = "en-US" } = options;

  const fmt = useCallback(
    (amount: number | string | null | undefined, currencyOverride?: string) =>
      formatCurrency(amount, currencyOverride ?? currency, locale),
    [currency, locale],
  );

  return fmt;
}
