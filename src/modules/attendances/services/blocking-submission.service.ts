// * File ini menangani validasi pengajuan yang memblokir absensi.
// & Resolve blocking submission state for attendance flow guards.
// % Menentukan status pengajuan yang memblokir alur absensi.

import {
    BlockingSubmissionOptions,
    findBlockingSubmissionByRange,
    findBlockingSubmissionMapByUserIds,
} from "../../../shared/attendances/submissions";

// & Find a single blocking submission for one user in a date range.
// % Cari satu pengajuan yang memblokir untuk satu user pada rentang tanggal.
/** Mengekspor findBlockingSubmission untuk kebutuhan modul ini. */
export const findBlockingSubmission = async (
  userId: string,
  dayStart: Date,
  dayEnd: Date,
  options: BlockingSubmissionOptions = {},
) => {
  return findBlockingSubmissionByRange(userId, dayStart, dayEnd, options);
};

// & Find blocking submissions map for multiple users in a date range.
// % Cari peta pengajuan yang memblokir untuk banyak user pada rentang tanggal.
/** Mengekspor findBlockingSubmissionByUserIds untuk kebutuhan modul ini. */
export const findBlockingSubmissionByUserIds = async (
  userIds: string[],
  dayStart: Date,
  dayEnd: Date,
  options: BlockingSubmissionOptions = {},
) => {
  return findBlockingSubmissionMapByUserIds(userIds, dayStart, dayEnd, options);
};
