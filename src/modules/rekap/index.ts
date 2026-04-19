// * Backend module: karyawan-be/src/modules/rekap/index.ts
// & This file defines backend logic for index.ts.
// % File ini mendefinisikan logika backend untuk index.ts.

import Elysia from "elysia";


export const historyRoutes = new Elysia({
  prefix: "/history",
  detail: { tags: ["History"] },
})
  