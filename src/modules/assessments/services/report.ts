// * File ini menangani operasi baca/report untuk module assessments.

import { AssessmentsService as LegacyAssessmentsService } from "../legacy";

// & Resolve assessment scope for current actor.
// % Tentukan scope penilaian untuk actor saat ini.
export const _getScope = LegacyAssessmentsService._getScope;

// & Get subordinate list for evaluator.
// % Ambil daftar bawahan untuk evaluator.
export const getSubordinates = LegacyAssessmentsService.getSubordinates;

// & Get dashboard statistics for assessments.
// % Ambil statistik dashboard penilaian.
export const getStatsForDashboard = LegacyAssessmentsService.getStatsForDashboard;

// & Get assessment report list.
// % Ambil daftar laporan penilaian.
export const getReport = LegacyAssessmentsService.getReport;

// & Get individual assessment report by assessment id.
// % Ambil laporan individual berdasarkan assessment id.
export const getIndividualReport = LegacyAssessmentsService.getIndividualReport;

// & Get individual assessment report by employee and period.
// % Ambil laporan individual berdasarkan karyawan dan periode.
export const getIndividualReportByEmployee =
  LegacyAssessmentsService.getIndividualReportByEmployee;

// & Get personal assessment results for employee.
// % Ambil hasil penilaian pribadi untuk karyawan.
export const getMyResults = LegacyAssessmentsService.getMyResults;
