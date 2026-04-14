// * File ini adalah facade orchestrator untuk module submissions.

import { create, deleteById, updateStatus } from "./create";
import { getAll, getDetailById, getMine } from "./report";

export const SubmissionService = {
  // & List submissions.
  // % Daftar pengajuan.
  getAll,

  // & List own submissions.
  // % Daftar pengajuan sendiri.
  getMine,

  // & Get submission detail.
  // % Ambil detail pengajuan.
  getDetailById,

  // & Create submission.
  // % Buat pengajuan.
  create,

  // & Delete submission.
  // % Hapus pengajuan.
  deleteById,

  // & Update submission status.
  // % Update status pengajuan.
  updateStatus,
};
