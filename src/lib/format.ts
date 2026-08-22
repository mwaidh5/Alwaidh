export function formatPrice(amount: number, currency = 'IQD'): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

export function classNames(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * How much a product is reduced by, as a whole percent — or 0 when it
 * isn't on offer. A "was" price at or below the current one is treated as
 * no discount rather than a negative one.
 */
export function discountPercent(price: number, oldPrice?: number | null): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}
