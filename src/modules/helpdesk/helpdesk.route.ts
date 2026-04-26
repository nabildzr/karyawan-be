// * File ini berisi definisi route (controller) untuk modul helpdesk (ticketing).
// & Semua business logic didelegasikan ke HelpdeskService.

import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAuth } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import {
  TicketAutoReplyUpdateDTO,
  TicketCreateDTO,
  TicketIdParamsDTO,
  TicketListQueryDTO,
  TicketRatingDTO,
  TicketRespondDTO,
  TicketSimilarityQueryDTO,
  TicketStatusUpdateDTO,
} from "./helpdesk.schema";
import { HelpdeskService } from "./helpdesk.service";

/** Mengekspor helpdeskRoutes untuk kebutuhan modul ini. */
export const helpdeskRoutes = new Elysia({
  prefix: "/tickets",
  detail: { tags: ["Helpdesk"] },
})
  .use(authPlugin)

  // ──────────────────────────────────────────
  // & POST / — Buat tiket baru
  // ──────────────────────────────────────────
  .post(
    "/",
    async ({ auth, body, set }) => {
      try {
        const data = await HelpdeskService.createTicket(auth!.sub, body);
        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({
          data,
          message: "Tiket berhasil dibuat.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      body: TicketCreateDTO,
      detail: { summary: "Create a new support ticket" },
    },
  )

  // ──────────────────────────────────────────
  // & GET / — List tiket (filter by status)
  // ──────────────────────────────────────────
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const result = await HelpdeskService.getTickets(query);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: result.data,
          meta: result.meta,
          message: "Berhasil mengambil daftar tiket.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      query: TicketListQueryDTO,
      detail: { summary: "Get list of tickets with optional status filter" },
    },
  )

  // ──────────────────────────────────────────
  // & GET /:id — Detail tiket + semua response
  // ──────────────────────────────────────────
  .get(
    "/suggestions",
    async ({ query, set }) => {
      try {
        const subjectQuery = (query.q ?? "").trim().toLowerCase();
        const suggestions = [
          "Laptop tidak bisa login",
          "Printer tidak bisa print",
          "VPN tidak terkoneksi",
          "Email tidak masuk",
          "Akses sistem ditolak",
          "Aplikasi crash saat dibuka",
          "Koneksi internet lambat",
          "Reset password akun",
        ].filter((item) => item.toLowerCase().includes(subjectQuery));

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: suggestions,
          message: "Berhasil mengambil saran subject.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      query: t.Object({
        q: t.Optional(t.String({ maxLength: 255 })),
      }),
      detail: { summary: "Get subject suggestions for ticket creation" },
    },
  )

  .get(
    "/similar",
    async ({ query, set }) => {
      try {
        const data = await HelpdeskService.findSimilarTickets(query);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil tiket serupa.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      query: TicketSimilarityQueryDTO,
      detail: { summary: "Find similar tickets by subject and description" },
    },
  )

  .get(
    "/:id",
    async ({ params, set }) => {
      try {
        const data = await HelpdeskService.getTicketDetail(params.id);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil detail tiket.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      params: TicketIdParamsDTO,
      detail: { summary: "Get ticket detail including all responses" },
    },
  )

  // ──────────────────────────────────────────
  // & POST /:id/respond — Tambah response ke tiket
  // ──────────────────────────────────────────
  .post(
    "/:id/respond",
    async ({ auth, params, body, set }) => {
      try {
        const data = await HelpdeskService.addResponse(
          params.id,
          auth!.sub,
          body,
        );
        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({
          data,
          message: "Response berhasil ditambahkan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      params: TicketIdParamsDTO,
      body: TicketRespondDTO,
      detail: { summary: "Add a response to a ticket" },
    },
  )

  // ──────────────────────────────────────────
  // & PATCH /:id/status — Update status tiket
  // ──────────────────────────────────────────
  .patch(
    "/:id/status",
    async ({ params, body, set }) => {
      try {
        const data = await HelpdeskService.updateStatus(params.id, body);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Status tiket berhasil diperbarui.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      params: TicketIdParamsDTO,
      body: TicketStatusUpdateDTO,
      detail: { summary: "Update ticket status (IN_PROGRESS or CLOSED)" },
    },
  )

  // ──────────────────────────────────────────
  // & POST /:id/rating — Tambah rating kepuasan
  // ──────────────────────────────────────────
  .patch(
    "/:id/auto-reply",
    async ({ params, body, set }) => {
      try {
        const data = await HelpdeskService.updateAutoReplyText(params.id, body);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Auto-reply text system berhasil diperbarui.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      params: TicketIdParamsDTO,
      body: TicketAutoReplyUpdateDTO,
      detail: { summary: "Update auto-reply text system for ticket" },
    },
  )

  .post(
    "/:id/rating",
    async ({ auth, params, body, set }) => {
      try {
        const data = await HelpdeskService.addRating(
          params.id,
          auth!.sub,
          body,
        );
        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({
          data,
          message: "Rating kepuasan berhasil disimpan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      params: TicketIdParamsDTO,
      body: TicketRatingDTO,
      detail: { summary: "Add satisfaction rating to a closed ticket" },
    },
  );
