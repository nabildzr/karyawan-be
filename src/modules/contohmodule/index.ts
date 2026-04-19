// * Backend module: karyawan-be/src/modules/contohmodule/index.ts
// & This file defines the Elysia controller for contohmodule.
// % File ini mendefinisikan controller Elysia untuk contohmodule.

import Elysia from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import { ContohQueryDTO } from "./model";
import { ContohService } from "./service";

export const contohRoutes = new Elysia({
  prefix: "/contoh",
  detail: { tags: ["Contoh"] },
})
  .use(authPlugin)

  // & ====== GET ALL Contoh ======
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const result = await ContohService.GetAllContoh({
          page: query.page,
          limit: query.limit,
          search: query.search,
        });
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: result.data,
          message: "Berhasil mengambil data contoh.",
          meta: result.meta,
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      query: ContohQueryDTO,
      detail: { summary: "Ambil semua data contoh (paginasi + search)" },
    },
  );

