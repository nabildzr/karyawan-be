export const BUSINESS_UTC_OFFSET = "+07:00";

const DAY_ORDER: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
  Minggu: 7,
};

// Convert Date object to YYYY-MM-DD.
export const toDateStr = (date: Date): string => date.toISOString().slice(0, 10);

// Sort day rows by weekday order.
export const sortDays = <T extends { dayOfWeek: string }>(days: T[]): T[] =>
  [...days].sort(
    (a, b) => (DAY_ORDER[a.dayOfWeek] ?? 8) - (DAY_ORDER[b.dayOfWeek] ?? 8),
  );
