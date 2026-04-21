// * Backend module route: src/modules/contohmodule/contohmodule.route.ts
// & This file defines endpoints and binds them to handlers for contohmodule.
// % File ini mendefinisikan endpoint dan mengikatnya ke handler untuk module contohmodule.

import Elysia from "elysia";
import { authPlugin } from "../../middleware/auth";
import { handleGetContohList } from "./contohmodule.handler";
import { ContohQueryDTO } from "./contohmodule.schema";

/** Mengekspor contohmoduleRoutes untuk kebutuhan modul ini. */
export const contohmoduleRoutes = new Elysia({
  prefix: "/contoh",
  detail: { tags: ["Contoh"] },
})
  .use(authPlugin)
  .get("/", handleGetContohList, {
    query: ContohQueryDTO,
    detail: { summary: "Ambil semua data contoh" },
  });