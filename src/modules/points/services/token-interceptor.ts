

// * Token interceptor service: src/modules/points/services/token-interceptor.ts
// & Automatic token application logic during attendance processing.
// % Logika aplikasi token otomatis saat pemrosesan absensi.

import { DEFAULT_TIMEZONE } from "../../../config/timezone";
import { getDayRangeByTimezone } from "../../../shared/attendances/schedules";
import type { AuditActor } from "../../../shared/audit/actor";
import { writeAuditLog } from "../../../shared/audit/writeAudit";
import { PointsRepository } from "../repository";