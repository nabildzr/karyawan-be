// * Backend module service: src/modules/attendances/service.ts
// & This file provides service facade and business orchestration for attendances module.
// % File ini menyediakan facade service dan orkestrasi business untuk module attendances.

import {
  correctAttendance,
  exportAttendances,
  getAll,
  getById,
  getSummaryStats,
  manualAttendance,
} from "./services/admin-report.service";
import { findBlockingSubmission } from "./services/blocking-submission.service";
import { checkIn, checkOut } from "./services/check.service";
import {
  generateBlipCaption,
  verifyFace,
  verifyFaceForAttendance,
} from "./services/face.service";
import {
  calculateStreak,
  calculateWorkingDays,
  getHistory,
  getHistoryById,
} from "./services/history.service";
import { getTodayContext } from "./services/today-context.service";

export const AttendanceService = {
  // & Check blocking submission in date range.
  // % Cek pengajuan yang memblokir absensi di rentang tanggal.
  findBlockingSubmission,

  // & Get current day attendance context.
  // % Ambil konteks absensi hari ini.
  getTodayContext,

  // & Perform employee check-in.
  // % Jalankan check-in karyawan.
  checkIn,

  // & Perform employee check-out.
  // % Jalankan check-out karyawan.
  checkOut,

  // & Create manual attendance entry.
  // % Buat entri absensi manual.
  manualAttendance,

  // & Correct existing attendance record.
  // % Koreksi data absensi yang sudah ada.
  correctAttendance,

  // & Get attendance history list.
  // % Ambil daftar riwayat absensi.
  getHistory,

  // & Get one attendance history detail by id for authenticated employee.
  // % Ambil satu detail riwayat absensi by id untuk karyawan terautentikasi.
  getHistoryById,

  // & Calculate employee working days.
  // % Hitung hari kerja karyawan.
  calculateWorkingDays,

  // & Calculate attendance streak.
  // % Hitung streak kehadiran.
  calculateStreak,

  // & Verify face match for attendance.
  // % Verifikasi kecocokan wajah untuk absensi.
  verifyFaceForAttendance,

  // & Generate BLIP caption for accessory detection flow.
  // % Generate caption BLIP untuk alur deteksi aksesori.
  generateBlipCaption,

  // & Verify face and return confidence payload.
  // % Verifikasi wajah dan kembalikan payload confidence.
  verifyFace,

  // & Get attendance list for admin report.
  // % Ambil daftar absensi untuk laporan admin.
  getAll,

  // & Get attendance detail by id.
  // % Ambil detail absensi berdasarkan id.
  getById,

  // & Get attendance summary stats.
  // % Ambil statistik ringkasan absensi.
  getSummaryStats,

  // & Export attendance report.
  // % Ekspor laporan absensi.
  exportAttendances,
};
