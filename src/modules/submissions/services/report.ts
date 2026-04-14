// * File ini menangani operasi baca/report untuk module submissions.

import { SubmissionService as LegacySubmissionService } from "../legacy";

// & Get submission list with filters.
// % Ambil daftar pengajuan dengan filter.
export const getAll = LegacySubmissionService.getAll;

// & Get current user submissions.
// % Ambil pengajuan milik user saat ini.
export const getMine = LegacySubmissionService.getMine;

// & Get submission detail by id.
// % Ambil detail pengajuan berdasarkan id.
export const getDetailById = LegacySubmissionService.getDetailById;
