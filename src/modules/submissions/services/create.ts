// * File ini menangani operasi tulis untuk module submissions.

import { SubmissionService } from "../implementation";

// & Create submission data.
// % Buat data pengajuan.
/** Mengekspor create untuk kebutuhan modul ini. */
export const create = SubmissionService.create;

// & Delete submission by id.
// % Hapus pengajuan berdasarkan id.
/** Mengekspor deleteById untuk kebutuhan modul ini. */
export const deleteById = SubmissionService.deleteById;

// & Update submission status.
// % Update status pengajuan.
/** Mengekspor updateStatus untuk kebutuhan modul ini. */
export const updateStatus = SubmissionService.updateStatus;
