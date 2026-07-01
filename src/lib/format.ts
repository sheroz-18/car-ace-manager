export function formatMoney(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(n: number | string | null | undefined): string {
  return new Intl.NumberFormat("ru-RU").format(Number(n ?? 0));
}

export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const CATEGORY_LABELS: Record<string, string> = {
  cases: "Чехлы",
  lamps: "Лампы",
  interior: "Аксессуары салона",
  electronics: "Электроника",
  other: "Другое",
};

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
  debt: "В долг",
};
