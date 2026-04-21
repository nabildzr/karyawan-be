// * Backend module: karyawan-be/src/modules/rekap/index.ts
// & This file defines backend logic for index.ts.
// % File ini mendefinisikan logika backend untuk index.ts.

import Elysia from "elysia";


/** Mengekspor historyRoutes untuk kebutuhan modul ini. */
export const historyRoutes = new Elysia({
  prefix: "/history",
  detail: { tags: ["History"] },
})
  