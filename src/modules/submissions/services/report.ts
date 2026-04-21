// * File ini menangani operasi baca/report untuk module submissions.

import { SubmissionService } from "../implementation";

// & Get submission list with filters.
// % Ambil daftar pengajuan dengan filter.
/** Mengekspor getAll untuk kebutuhan modul ini. */
export const getAll = SubmissionService.getAll;

// & Get current user submissions.
// % Ambil pengajuan milik user saat ini.
/** Mengekspor getMine untuk kebutuhan modul ini. */
export const getMine = SubmissionService.getMine;

// & Get submission detail by id.
// % Ambil detail pengajuan berdasarkan id.
/** Mengekspor getDetailById untuk kebutuhan modul ini. */
export const getDetailById = SubmissionService.getDetailById;
