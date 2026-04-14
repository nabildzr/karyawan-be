import { t } from "elysia";
import { ShiftsPlain } from "../../generated/prismabox/Shifts";

// & ============ Reusable ============
export const ShiftResponseDTO = ShiftsPlain;

const DayInputDTO = t.Object({
  dayOfWeek: t.String({ examples: ["Monday"] }),
  isActive: t.Boolean({ default: true }),
  startTime: t.Optional(t.String({ examples: ["08:00"] })),
  endTime: t.Optional(t.String({ examples: ["17:00"] })),
  isCrossDay: t.Optional(
    t.Boolean({
      default: false,
      description: "true jika shift melewati tengah malam, misal 22:00–06:00",
    }),
  ),
});

// & ============ Request DTOs ============

/** POST /working-schedules — buat jadwal baru */
export const CreateScheduleDTO = t.Object({
  name: t.String({ examples: ["Jadwal Operasional Kantor"] }),
  employeeIds: t.Optional(t.Array(t.String())),
  days: t.Array(DayInputDTO),
});
export type CreateSchedulePayload = typeof CreateScheduleDTO.static;

/** PUT /working-schedules/:id/assign — ganti daftar karyawan */
export const AssignEmployeesDTO = t.Object({
  employeeIds: t.Array(t.String()),
});
export type AssignEmployeesPayload = typeof AssignEmployeesDTO.static;

/** GET /working-schedules/mobile/summary — query range tanggal */
export const MobileSummaryQueryDTO = t.Object({
  // startDate: t.String({
  //   default: "2026-03-01",
  //   examples: ["2026-03-01"]
  // }),
  // endDate: t.String({
  //   default: "2026-03-7",
  //   examples: ["2026-03-07"]
  // }),
  startDate: t.String({
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    examples: ["2026-03-01"],
    default: "2026-03-01",
  }),
  endDate: t.String({
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    examples: ["2026-03-07"],
    default: "2026-03-07",
  }),
  timezone: t.String({
    default: "Asia/Jakarta",
    examples: ["Asia/Jakarta"],
    description: "IANA timezone pengguna, misal Asia/Jakarta",
  }),
});
