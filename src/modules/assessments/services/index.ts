// * File ini adalah facade orchestrator untuk module assessments.

import { create, exportIndividualPDF, exportReport, update } from "./create";
import {
    _getScope,
    getIndividualReport,
    getIndividualReportByEmployee,
    getMyResults,
    getReport,
    getStatsForDashboard,
    getSubordinates,
} from "./report";

export const AssessmentsService = {
  // & Resolve assessment scope.
  // % Tentukan scope penilaian.
  _getScope,

  // & Get subordinates list.
  // % Ambil daftar bawahan.
  getSubordinates,

  // & Create assessment.
  // % Buat penilaian.
  create,

  // & Update assessment.
  // % Update penilaian.
  update,

  // & Get dashboard stats.
  // % Ambil statistik dashboard.
  getStatsForDashboard,

  // & Get assessment report list.
  // % Ambil daftar laporan penilaian.
  getReport,

  // & Get individual report.
  // % Ambil laporan individual.
  getIndividualReport,

  // & Get individual report by employee and period.
  // % Ambil laporan individual berdasarkan karyawan dan periode.
  getIndividualReportByEmployee,

  // & Export individual PDF.
  // % Ekspor PDF individual.
  exportIndividualPDF,

  // & Export report file.
  // % Ekspor file laporan.
  exportReport,

  // & Get personal results.
  // % Ambil hasil pribadi.
  getMyResults,
};
