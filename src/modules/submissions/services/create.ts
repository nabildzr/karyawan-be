// * File ini menangani operasi tulis untuk module submissions.

import { SubmissionService as LegacySubmissionService } from "../legacy";

// & Create submission data.
// % Buat data pengajuan.
export const create = LegacySubmissionService.create;

// & Delete submission by id.
// % Hapus pengajuan berdasarkan id.
export const deleteById = LegacySubmissionService.deleteById;

// & Update submission status.
// % Update status pengajuan.
export const updateStatus = LegacySubmissionService.updateStatus;
