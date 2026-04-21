// * File ini menangani operasi baca/report untuk module assessments.

import { AssessmentsService } from "../implementation";

// & Resolve assessment scope for current actor.
// % Tentukan scope penilaian untuk actor saat ini.
/** Mengekspor _getScope untuk kebutuhan modul ini. */
export const _getScope = AssessmentsService._getScope;

// & Get subordinate list for evaluator.
// % Ambil daftar bawahan untuk evaluator.
/** Mengekspor getSubordinates untuk kebutuhan modul ini. */
export const getSubordinates = AssessmentsService.getSubordinates;

// & Get dashboard statistics for assessments.
// % Ambil statistik dashboard penilaian.
/** Mengekspor getStatsForDashboard untuk kebutuhan modul ini. */
export const getStatsForDashboard = AssessmentsService.getStatsForDashboard;

// & Get assessment report list.
// % Ambil daftar laporan penilaian.
/** Mengekspor getReport untuk kebutuhan modul ini. */
export const getReport = AssessmentsService.getReport;

// & Get individual assessment report by assessment id.
// % Ambil laporan individual berdasarkan assessment id.
/** Mengekspor getIndividualReport untuk kebutuhan modul ini. */
export const getIndividualReport = AssessmentsService.getIndividualReport;

// & Get individual assessment report by employee and period.
// % Ambil laporan individual berdasarkan karyawan dan periode.
/** Mengekspor getIndividualReportByEmployee untuk kebutuhan modul ini. */
export const getIndividualReportByEmployee =
  AssessmentsService.getIndividualReportByEmployee;

// & Get personal assessment results for employee.
// % Ambil hasil penilaian pribadi untuk karyawan.
/** Mengekspor getMyResults untuk kebutuhan modul ini. */
export const getMyResults = AssessmentsService.getMyResults;
