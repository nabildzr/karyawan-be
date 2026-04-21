// * File ini menangani operasi tulis untuk module assessments.

import { AssessmentsService } from "../implementation";

// & Create assessment data.
// % Buat data penilaian.
/** Mengekspor create untuk kebutuhan modul ini. */
export const create = AssessmentsService.create;

// & Update assessment data.
// % Update data penilaian.
/** Mengekspor update untuk kebutuhan modul ini. */
export const update = AssessmentsService.update;

// & Export individual assessment PDF.
// % Ekspor PDF penilaian individual.
/** Mengekspor exportIndividualPDF untuk kebutuhan modul ini. */
export const exportIndividualPDF = AssessmentsService.exportIndividualPDF;

// & Export assessment report in file format.
// % Ekspor laporan penilaian dalam format file.
/** Mengekspor exportReport untuk kebutuhan modul ini. */
export const exportReport = AssessmentsService.exportReport;
