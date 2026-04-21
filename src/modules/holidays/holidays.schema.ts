import { t } from "elysia";

/** Mengekspor HolidayListQueryDTO untuk kebutuhan modul ini. */
export const HolidayListQueryDTO = t.Object({
  page: t.Optional(t.Number({ default: 1, minimum: 1 })),
  limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
  year: t.Optional(
    t.Number({ description: "Filter berdasarkan tahun, misal: 2026" }),
  ),
  search: t.Optional(
    t.String({ description: "Cari berdasarkan nama hari libur" }),
  ),
});

/** Mengekspor HolidayIdParamsDTO untuk kebutuhan modul ini. */
export const HolidayIdParamsDTO = t.Object({
  id: t.String(),
});

/** Mengekspor HolidayCreateBodyDTO untuk kebutuhan modul ini. */
export const HolidayCreateBodyDTO = t.Object({
  name: t.String({ minLength: 1, description: "Nama hari libur" }),
  date: t.String({
    format: "date",
    description: "Tanggal dalam format YYYY-MM-DD",
  }),
});

/** Mengekspor HolidayUpdateBodyDTO untuk kebutuhan modul ini. */
export const HolidayUpdateBodyDTO = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  date: t.Optional(t.String({ format: "date" })),
});

/** Mengekspor HolidayDTO untuk kebutuhan modul ini. */
export const HolidayDTO = t.Object({
  id: t.String(),
  name: t.String(),
  date: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

/** Mengekspor HolidayListMetaDTO untuk kebutuhan modul ini. */
export const HolidayListMetaDTO = t.Object({
  total: t.Number(),
  page: t.Number(),
  limit: t.Number(),
  totalPages: t.Number(),
});

/** Mendefinisikan alias tipe untuk HolidayListQueryPayload. */
export type HolidayListQueryPayload = typeof HolidayListQueryDTO.static;

/** Mendefinisikan alias tipe untuk HolidayIdParamsPayload. */
export type HolidayIdParamsPayload = typeof HolidayIdParamsDTO.static;

/** Mendefinisikan alias tipe untuk HolidayCreateBodyPayload. */
export type HolidayCreateBodyPayload = typeof HolidayCreateBodyDTO.static;

/** Mendefinisikan alias tipe untuk HolidayUpdateBodyPayload. */
export type HolidayUpdateBodyPayload = typeof HolidayUpdateBodyDTO.static;

/** Mendefinisikan alias tipe untuk HolidayPayload. */
export type HolidayPayload = typeof HolidayDTO.static;

/** Mendefinisikan alias tipe untuk HolidayListMetaPayload. */
export type HolidayListMetaPayload = typeof HolidayListMetaDTO.static;
