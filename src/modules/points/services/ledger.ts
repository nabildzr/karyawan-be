

// * Point ledger service: src/modules/points/services/ledger.ts
// & Centralized ledger recording with audit trail for all point mutations.
// % Pencatatan buku besar terpusat dengan jejak audit untuk semua mutasi poin.

import { TransactionType } from "../../../generated/prisma/enums";
import type { AuditActor } from "../../../shared/audit/actor";
import { writeAuditLog } from "../../../shared/audit/writeAudit";
import { NotificationService } from "../../notifications/service";
import { PointsRepository } from "../repository";
import {
  INTEGRITY_THRESHOLDS,
  getIntegrityLevel,
  getNextIntegrityLevel,
} from "../utils/levels";