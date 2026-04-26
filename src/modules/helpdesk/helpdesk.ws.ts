// * File ini berisi WebSocket handler real-time untuk modul helpdesk (ticketing).
// & Menggunakan built-in Elysia WebSocket untuk broadcast event tiket.

import Elysia from "elysia";
import { authPlugin } from "../../middleware/auth";
import { initHelpdeskBroker, onIncomingHelpdeskEvent } from "./helpdesk.broker";

// ──────────────────────────────────────────────────────────────
// & In-memory room registry
// % Map: ticketId -> Set<WebSocket>
// ──────────────────────────────────────────────────────────────

type WsClient = {
  send: (data: string) => void;
  data: { ticketId: string; userId: string };
};

const ticketRooms = new Map<string, Set<WsClient>>();
let brokerRelayRegistered = false;

/** Utility: join room. */
function joinRoom(ticketId: string, ws: WsClient) {
  if (!ticketRooms.has(ticketId)) {
    ticketRooms.set(ticketId, new Set());
  }
  ticketRooms.get(ticketId)!.add(ws);
}

/** Utility: leave room. */
function leaveRoom(ticketId: string, ws: WsClient) {
  ticketRooms.get(ticketId)?.delete(ws);
  if (ticketRooms.get(ticketId)?.size === 0) {
    ticketRooms.delete(ticketId);
  }
}

/**
 * Broadcast event ke semua client dalam room tiket tertentu.
 * @param ticketId  ID tiket target
 * @param event     Nama event (new_response, status_updated, dsb)
 * @param payload   Data yang dikirim ke client
 */
export function broadcastToTicket(
  ticketId: string,
  event: string,
  payload: unknown,
) {
  const room = ticketRooms.get(ticketId);
  if (!room || room.size === 0) return;

  const message = JSON.stringify({ event, type: event, data: payload, ticketId });
  for (const client of room) {
    try {
      client.send(message);
    } catch {
      // Client mungkin sudah disconnect
      leaveRoom(ticketId, client);
    }
  }
}

function registerBrokerRelay() {
  if (brokerRelayRegistered) return;
  brokerRelayRegistered = true;

  onIncomingHelpdeskEvent((payload) => {
    if (!payload.ticketId || !payload.event) return;
    broadcastToTicket(payload.ticketId, payload.event, payload.data);
  });
}

// ──────────────────────────────────────────────────────────────
// & Elysia WebSocket Route
// % ws: /tickets/ws/:ticketId
// ──────────────────────────────────────────────────────────────

/** Mengekspor helpdeskWsRoute untuk kebutuhan modul ini. */
export const helpdeskWsRoute = new Elysia({ prefix: "/tickets" })
  .use(authPlugin)
  .onStart(async () => {
    registerBrokerRelay();
    await initHelpdeskBroker();
  })
  .ws("/ws/:ticketId", {
    /**
     * Saat koneksi WebSocket dibuka, join room tiket.
     */
    open(ws) {
      const ticketId = (ws.data as any).params?.ticketId as string;
      const userId = (ws.data as any).auth?.sub as string;

      if (!ticketId || !userId) {
        ws.close(4001, "Unauthorized: token JWT diperlukan.");
        return;
      }

      // Simpan context ke ws.data agar bisa diakses saat message/close
      (ws as any)._ticketId = ticketId;
      (ws as any)._userId = userId;

      const client: WsClient = {
        send: (data) => ws.send(data),
        data: { ticketId, userId },
      };

      // Simpan referensi client ke ws object agar bisa di-remove saat close
      (ws as any)._client = client;

      joinRoom(ticketId, client);

      ws.send(
        JSON.stringify({
          event: "connected",
          type: "connected",
          data: { ticketId, message: "Terhubung ke room tiket." },
        }),
      );
    },

    /**
     * Saat koneksi WebSocket ditutup, leave room tiket.
     */
    close(ws) {
      const ticketId = (ws as any)._ticketId as string | undefined;
      const client = (ws as any)._client as WsClient | undefined;
      if (ticketId && client) {
        leaveRoom(ticketId, client);
      }
    },

    /**
     * Saat menerima pesan dari client (ping keepalive, dsb).
     */
    message(ws, message) {
      // Hanya handle ping untuk keepalive
      if (message === "ping" || message === '"ping"') {
        ws.send(JSON.stringify({ event: "pong", type: "pong" }));
      }
    },
  });
