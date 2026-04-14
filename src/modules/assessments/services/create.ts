// * File ini menangani operasi tulis untuk module assessments.

import { AssessmentsService as LegacyAssessmentsService } from "../legacy";

// & Create assessment data.
// % Buat data penilaian.
export const create = LegacyAssessmentsService.create;

// & Update assessment data.
// % Update data penilaian.
export const update = LegacyAssessmentsService.update;

// & Export individual assessment PDF.
// % Ekspor PDF penilaian individual.
export const exportIndividualPDF = LegacyAssessmentsService.exportIndividualPDF;

// & Export assessment report in file format.
// % Ekspor laporan penilaian dalam format file.
export const exportReport = LegacyAssessmentsService.exportReport;
