import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import { DashboardService } from "./service";

/** Mengekspor dashboardRoutes untuk kebutuhan modul ini. */
export const dashboardRoutes = new Elysia({
	prefix: "/dashboard",
	detail: { tags: ["Dashboard"] },
})
	.use(authPlugin)
	.get(
		"/admin",
		async ({ query, set }) => {
			try {
				const data = await DashboardService.getAdminDashboard({
					recentLimit: query.recentLimit,
				});

				set.status = HttpStatusEnum.HTTP_200_OK;
				return successResponse({
					data,
					message: "Berhasil mengambil ringkasan dashboard admin.",
				});
			} catch (error: any) {
				return mapError(error, set);
			}
		},
		{
			beforeHandle: [checkAdmin],
			query: t.Object({
				recentLimit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
			}),
			detail: {
				summary: "[Admin] Ambil ringkasan dashboard khusus admin",
			},
		},
	);
