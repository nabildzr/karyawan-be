import { publishHelpdeskEvent } from "./helpdesk.broker";
import { HelpdeskRepository } from "./helpdesk.repository";
import type {
    TicketAutoReplyUpdatePayload,
    TicketCreatePayload,
    TicketListQuery,
    TicketRatingPayload,
    TicketRespondPayload,
    TicketSimilarityQuery,
    TicketStatusUpdatePayload,
} from "./helpdesk.schema";
import { broadcastToTicket } from "./helpdesk.ws";

const prisma = HelpdeskRepository.db;

// ──────────────────────────────────────────────────────────────
// & Helpers
// ──────────────────────────────────────────────────────────────

/** Select fields standar untuk data reporter/operator/responder. */
const userSelect = {
  id: true,
  nip: true,
  employees: {
    select: { fullName: true, email: true },
  },
} as const;

const DEFAULT_AUTO_REPLY_TEXT =
  "Terima kasih sudah menghubungi helpdesk. Tim kami sedang meninjau aduan Anda.";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY ??
  "api_key_1234567890abcdefg"; 

function stripHtml(raw: string): string {
  return raw.replace(/<[^>]*>/g, " ");
}

function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function uniqueTokens(raw: string): Set<string> {
  return new Set(tokenize(raw));
}

function calcJaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function calcDice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return (2 * intersection) / (a.size + b.size);
}

function toSimilarityPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

async function resolveSystemResponderId(
  tx: typeof prisma,
  ticket: { operatorId: string | null; reporterId: string },
) {
  if (ticket.operatorId) return ticket.operatorId;

  const adminUser = await tx.users.findFirst({
    where: {
      id: { not: ticket.reporterId },
      rbacRole: { canAccessAdmin: true },
    },
    select: { id: true },
  });

  if (adminUser?.id) return adminUser.id;

  const fallbackUser = await tx.users.findFirst({
    where: { id: { not: ticket.reporterId } },
    select: { id: true },
  });
  return fallbackUser?.id ?? null;
}

async function generateAutoReplyFromOpenRouter(params: {
  subject: string;
  description: string;
  firstMessage: string;
  autoReplyText: string | null;
}) {
  const baseInstruction =
    params.autoReplyText?.trim() || DEFAULT_AUTO_REPLY_TEXT;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Kamu adalah sistem auto-reply helpdesk perusahaan. Balas singkat, sopan, profesional, bahasa Indonesia. Maksimal 2 kalimat.",
          },
          {
            role: "user",
            content: [
              `Template auto-reply dasar: ${baseInstruction}`,
              `Subject tiket: ${params.subject}`,
              `Deskripsi tiket: ${stripHtml(params.description)}`,
              `Pesan pertama pengadu: ${params.firstMessage}`,
              "Buat balasan konfirmasi bahwa aduan diterima dan sedang diproses.",
            ].join("\n"),
          },
        ],
        temperature: 0.4,
        max_tokens: 160,
      }),
    });

    if (!response.ok) {
      return baseInstruction;
    }

    const payload = (await response.json().catch(() => null)) as
      | {
          choices?: Array<{ message?: { content?: string } }>;
        }
      | null;
    const content = payload?.choices?.[0]?.message?.content?.trim();
    if (!content) return baseInstruction;
    return content;
  } catch {
    return baseInstruction;
  }
}

// ──────────────────────────────────────────────────────────────
// & HelpdeskService
// ──────────────────────────────────────────────────────────────

/** Mengekspor HelpdeskService untuk kebutuhan modul ini. */
export const HelpdeskService = {
  // ──────────────────────────────────────────
  // & 1. POST /tickets — Buat tiket baru
  // ──────────────────────────────────────────
  /**
   * Membuat tiket baru oleh pelapor.
   * @param reporterId  ID user yang membuat tiket
   * @param payload     Data tiket yang akan dibuat
   */
  async createTicket(reporterId: string, payload: TicketCreatePayload) {
    // Validasi reporter ada
    const reporter = await prisma.users.findUnique({
      where: { id: reporterId },
      select: { id: true },
    });
    if (!reporter) {
      throw new Error("Not Found: Pengguna pelapor tidak ditemukan.");
    }

    const ticket = await prisma.tickets.create({
      data: {
        reporterId,
        subject: payload.subject.trim(),
        description: payload.description.trim(),
        autoReplyText: DEFAULT_AUTO_REPLY_TEXT,
        priority: (payload.priority ?? "MEDIUM") as any,
        status: "OPEN",
      },
      include: {
        reporter: { select: userSelect },
        operator: { select: userSelect },
      },
    });

    return ticket;
  },

  // ──────────────────────────────────────────
  // & 2. GET /tickets?status= — List tiket (with filter)
  // ──────────────────────────────────────────
  /**
   * Mendapatkan daftar tiket dengan filter status opsional.
   * @param query  Parameter query: status, priority, page, limit
   */
  async getTickets(query: TicketListQuery) {
    const { status, priority, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.tickets.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          reporter: { select: userSelect },
          operator: { select: userSelect },
          _count: { select: { responses: true } },
        },
      }),
      prisma.tickets.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  },

  async findSimilarTickets(query: TicketSimilarityQuery) {
    const subject = (query.subject ?? "").trim();
    const description = (query.description ?? "").trim();
    const limit = query.limit ?? 5;
    const combinedInput = `${subject} ${stripHtml(description)}`.trim();

    if (combinedInput.length < 5) {
      return [];
    }

    const combinedTokens = tokenize(combinedInput);
    const queryTerms = Array.from(new Set(combinedTokens)).slice(0, 6);
    const where =
      queryTerms.length > 0
        ? {
            OR: queryTerms.flatMap((term) => [
              { subject: { contains: term, mode: "insensitive" as const } },
              { description: { contains: term, mode: "insensitive" as const } },
            ]),
          }
        : undefined;

    const candidates = await prisma.tickets.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 150,
      include: {
        reporter: { select: userSelect },
        operator: { select: userSelect },
        _count: { select: { responses: true } },
      },
    });

    const querySubjectTokens = uniqueTokens(subject);
    const queryDescriptionTokens = uniqueTokens(stripHtml(description));
    const queryCombinedTokens = uniqueTokens(combinedInput);

    return candidates
      .map((ticket) => {
        const ticketSubjectTokens = uniqueTokens(ticket.subject);
        const ticketDescriptionTokens = uniqueTokens(stripHtml(ticket.description));
        const ticketCombinedTokens = uniqueTokens(
          `${ticket.subject} ${stripHtml(ticket.description)}`,
        );

        const subjectScore = calcJaccard(querySubjectTokens, ticketSubjectTokens);
        const descriptionScore = calcJaccard(
          queryDescriptionTokens,
          ticketDescriptionTokens,
        );
        const combinedScore = calcDice(queryCombinedTokens, ticketCombinedTokens);

        const score =
          subjectScore * 0.45 + descriptionScore * 0.25 + combinedScore * 0.3;
        const similarity = toSimilarityPercent(score);

        return { ticket, similarity };
      })
      .filter((item) => item.similarity >= 20)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  },

  // ──────────────────────────────────────────
  // & 3. GET /tickets/:id — Detail tiket + semua response
  // ──────────────────────────────────────────
  /**
   * Mendapatkan detail tiket beserta semua response-nya.
   * @param ticketId  ID tiket yang ingin dilihat
   */
  async getTicketDetail(ticketId: string) {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        reporter: { select: userSelect },
        operator: { select: userSelect },
        responses: {
          orderBy: { createdAt: "asc" },
          include: {
            responder: { select: userSelect },
          },
        },
        satisfactionRating: true,
      },
    });

    if (!ticket) {
      throw new Error("Not Found: Tiket tidak ditemukan.");
    }

    return ticket;
  },

  // ──────────────────────────────────────────
  // & 4. POST /tickets/:id/respond — Tambah response
  // ──────────────────────────────────────────
  /**
   * Menambahkan response ke tiket.
   * Set firstResponseAt pada respons pertama dari operator/non-reporter.
   * @param ticketId    ID tiket yang direspons
   * @param responderId ID user yang merespons
   * @param payload     Data pesan respons
   */
  async addResponse(
    ticketId: string,
    responderId: string,
    payload: TicketRespondPayload,
  ) {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        status: true,
        reporterId: true,
        operatorId: true,
        firstResponseAt: true,
        subject: true,
        description: true,
        autoReplyText: true,
      },
    });

    if (!ticket) {
      throw new Error("Not Found: Tiket tidak ditemukan.");
    }

    if (ticket.status === "CLOSED") {
      throw new Error("Conflict: Tiket sudah ditutup, tidak dapat direspons.");
    }

    let autoReplyBroadcastPayload: any = null;

    // Buat response dalam transaction supaya firstResponseAt konsisten
    const result = await prisma.$transaction(async (tx) => {
      const existingResponseCount = await tx.ticketResponses.count({
        where: { ticketId },
      });

      const response = await tx.ticketResponses.create({
        data: {
          ticketId,
          responderId,
          message: payload.message.trim(),
          isAutoReply: payload.isAutoReply ?? false,
        },
        include: {
          responder: { select: userSelect },
        },
      });

      // Set firstResponseAt jika responden bukan reporter dan belum pernah ada response
      const isFirstResponse =
        !ticket.firstResponseAt && responderId !== ticket.reporterId;

      if (isFirstResponse) {
        await tx.tickets.update({
          where: { id: ticketId },
          data: { firstResponseAt: new Date() },
        });
      }

      const shouldAutoReply =
        responderId === ticket.reporterId && existingResponseCount === 0;

      if (shouldAutoReply) {
        const systemResponderId = await resolveSystemResponderId(tx, {
          operatorId: ticket.operatorId ?? null,
          reporterId: ticket.reporterId,
        });

        if (systemResponderId) {
          const autoReplyMessage = await generateAutoReplyFromOpenRouter({
            subject: ticket.subject,
            description: ticket.description,
            firstMessage: payload.message.trim(),
            autoReplyText: ticket.autoReplyText,
          });

          const autoReply = await tx.ticketResponses.create({
            data: {
              ticketId,
              responderId: systemResponderId,
              message: autoReplyMessage,
              isAutoReply: true,
            },
            include: {
              responder: { select: userSelect },
            },
          });

          if (!ticket.firstResponseAt) {
            await tx.tickets.update({
              where: { id: ticketId },
              data: { firstResponseAt: new Date() },
            });
          }

          autoReplyBroadcastPayload = autoReply;
        }
      }

      return response;
    });

    // Broadcast real-time event ke semua client dalam room tiket
    broadcastToTicket(ticketId, "new_response", {
      ...result,
    });

    await publishHelpdeskEvent("new_response", ticketId, {
      ...result,
    });

    if (autoReplyBroadcastPayload) {
      broadcastToTicket(ticketId, "new_response", autoReplyBroadcastPayload);
      await publishHelpdeskEvent("new_response", ticketId, autoReplyBroadcastPayload);
    }

    return result;
  },

  async updateAutoReplyText(
    ticketId: string,
    payload: TicketAutoReplyUpdatePayload,
  ) {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticket) {
      throw new Error("Not Found: Tiket tidak ditemukan.");
    }

    return prisma.tickets.update({
      where: { id: ticketId },
      data: { autoReplyText: payload.autoReplyText.trim() },
      include: {
        reporter: { select: userSelect },
        operator: { select: userSelect },
      },
    });
  },

  // ──────────────────────────────────────────
  // & 5. PATCH /tickets/:id/status — Update status
  // ──────────────────────────────────────────
  /**
   * Memperbarui status tiket.
   * Otomatis set closedAt saat status menjadi CLOSED.
   * @param ticketId  ID tiket yang diperbarui
   * @param payload   Data status baru dan optional operatorId
   */
  async updateStatus(ticketId: string, payload: TicketStatusUpdatePayload) {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true },
    });

    if (!ticket) {
      throw new Error("Not Found: Tiket tidak ditemukan.");
    }

    if (ticket.status === "CLOSED") {
      throw new Error("Conflict: Tiket sudah ditutup, status tidak dapat diubah.");
    }

    const updateData: any = {
      status: payload.status,
    };

    // Assign operator jika disediakan
    if (payload.operatorId) {
      const operator = await prisma.users.findUnique({
        where: { id: payload.operatorId },
        select: { id: true },
      });
      if (!operator) {
        throw new Error("Not Found: Operator dengan ID tersebut tidak ditemukan.");
      }
      updateData.operatorId = payload.operatorId;
    }

    // Set closedAt saat status CLOSED
    if (payload.status === "CLOSED") {
      updateData.closedAt = new Date();
    }

    const updated = await prisma.tickets.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        reporter: { select: userSelect },
        operator: { select: userSelect },
      },
    });

    // Broadcast real-time event ke semua client dalam room tiket
    broadcastToTicket(ticketId, "status_updated", {
      ticketId,
      status: updated.status,
      closedAt: updated.closedAt,
      operatorId: updated.operatorId,
    });

    await publishHelpdeskEvent("status_updated", ticketId, {
      ticketId,
      status: updated.status,
      closedAt: updated.closedAt,
      operatorId: updated.operatorId,
    });

    return updated;
  },

  // ──────────────────────────────────────────
  // & 6. POST /tickets/:id/rating — Tambah rating kepuasan
  // ──────────────────────────────────────────
  /**
   * Menambahkan rating kepuasan layanan untuk tiket.
   * Hanya bisa dilakukan setelah tiket CLOSED dan belum pernah diberi rating.
   * @param ticketId   ID tiket yang diberi rating
   * @param reporterId ID user yang memberikan rating (harus pemilik tiket)
   * @param payload    Data score dan feedback
   */
  async addRating(
    ticketId: string,
    reporterId: string,
    payload: TicketRatingPayload,
  ) {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        status: true,
        reporterId: true,
        satisfactionRating: { select: { id: true } },
      },
    });

    if (!ticket) {
      throw new Error("Not Found: Tiket tidak ditemukan.");
    }

    if (ticket.reporterId !== reporterId) {
      throw new Error("Forbidden: Hanya pelapor tiket yang dapat memberikan rating.");
    }

    if (ticket.status !== "CLOSED") {
      throw new Error("Conflict: Rating hanya bisa diberikan setelah tiket ditutup.");
    }

    if (ticket.satisfactionRating) {
      throw new Error("Conflict: Tiket ini sudah mendapatkan rating kepuasan.");
    }

    const rating = await prisma.satisfactionRatings.create({
      data: {
        ticketId,
        score: payload.score,
        feedback: payload.feedback?.trim() ?? null,
      },
    });

    return rating;
  },
};
