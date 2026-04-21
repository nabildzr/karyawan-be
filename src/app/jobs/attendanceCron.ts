// * Backend module: karyawan-be/src/app/jobs/attendanceCron.ts
// & This file defines backend logic for attendanceCron.ts.
// % File ini mendefinisikan logika backend untuk attendanceCron.ts.

import { cron } from "@elysiajs/cron";
import { Elysia } from "elysia";
import prisma from "../../config/prisma";
import { findBlockingSubmissionByUserIds } from "../../modules/attendances/services/blocking-submission.service";
import { PointsService } from "../../modules/points/service";
import { checkIsHoliday } from "../../utils/holidayshelper";

const DEFAULT_TIMEZONE = "Asia/Jakarta";
const JAKARTA_UTC_OFFSET = "+07:00";
const SYSTEM_ACTOR = {
  id: "SYSTEM",
  role: "SYSTEM",
};

const EN_TO_ID: Record<string, string> = {
  Monday: "Senin",
  Tuesday: "Selasa",
  Wednesday: "Rabu",
  Thursday: "Kamis",
  Friday: "Jumat",
  Saturday: "Sabtu",
  Sunday: "Minggu",
};

const getDayNameEN = (date: Date, timezone: string) =>
  date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: timezone,
  });

const getDayRangeByTimezone = (date: Date, timezone: string) => {
  const dayKey = date.toLocaleDateString("sv-SE", { timeZone: timezone });
  const dayStart = new Date(`${dayKey}T00:00:00.000${JAKARTA_UTC_OFFSET}`);
  const dayEnd = new Date(`${dayKey}T23:59:59.999${JAKARTA_UTC_OFFSET}`);
  return { dayKey, dayStart, dayEnd };
};

const getShiftWindowByDayKey = (
  dayKey: string,
  shift: { startTime: string; endTime: string; isCrossDay: boolean },
) => {
  const shiftStart = new Date(
    `${dayKey}T${shift.startTime}:00.000${JAKARTA_UTC_OFFSET}`,
  );
  const shiftEnd = new Date(
    `${dayKey}T${shift.endTime}:00.000${JAKARTA_UTC_OFFSET}`,
  );

  if (shift.isCrossDay) {
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }

  return { shiftStart, shiftEnd };
};

/** Mengekspor attendanceCronPlugin untuk kebutuhan modul ini. */
export const attendanceCronPlugin = new Elysia().use(
  cron({
    name: "auto-alpha-generator",
    // Pattern: Detik Menit Jam Tanggal Bulan Hari (Jalan tiap 23:59:00)
    pattern: "0 44 13 * * *",
    async run() {
      console.log("[CRON] 🤖 Memulai pengecekan Alpha harian...");

      try {
        const now = new Date();
        const currentDayEN = getDayNameEN(now, DEFAULT_TIMEZONE);
        const currentDayID = EN_TO_ID[currentDayEN] ?? currentDayEN;
        const { dayKey, dayStart, dayEnd } = getDayRangeByTimezone(
          now,
          DEFAULT_TIMEZONE,
        );

        // ? cek libur nasional dulu, biar kalau hari ini tanggal merah, cronjob langsung stop dan gak usah cek jadwal kerja
        const isHoliday = await checkIsHoliday(now);

        if (isHoliday) {
          console.log(
            `[CRON] 🌴 Hari ini tanggal merah (${isHoliday.name}). Libur bro, gak ada Alpha!`,
          );
          return; // Langsung stop cronjob-nya
        }

        // 1. Tarik semua ScheduleDays yang AKTIF HARI INI, bawa relasi karyawannya
        const activeSchedules = await prisma.scheduleDays.findMany({
          where: {
            dayOfWeek: {
              in: [currentDayID, currentDayEN],
            },
            isActive: true, // Hari ini masuk
          },
          include: {
            // 🔥 FIX 2: Bawa data shift biar gak crash pas displit jamnya
            shift: true,
            workingSchedule: {
              include: {
                employees: {
                  include: {
                    user: {
                      include: {
                        rbacRole: {
                          select: { key: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });
        // Taruh ini di bawah query prisma.scheduleDays.findMany
        console.log(
          `[DEBUG] Mencari jadwal aktif untuk hari: ${currentDayID} / ${currentDayEN}`,
        );
        console.log(
          `[DEBUG] Ketemu jadwal aktif sebanyak: ${activeSchedules.length}`,
        );

        // Hanya proses alpha untuk shift yang memang sudah selesai saat cron berjalan.
        const endedSchedules = activeSchedules.filter((scheduleDay) => {
          if (!scheduleDay.shift) return false;

          const { shiftEnd } = getShiftWindowByDayKey(dayKey, {
            startTime: scheduleDay.shift.startTime,
            endTime: scheduleDay.shift.endTime,
            isCrossDay: scheduleDay.shift.isCrossDay,
          });

          return now >= shiftEnd;
        });

        console.log(
          `[DEBUG] Jadwal yang shift-nya sudah selesai: ${endedSchedules.length}`,
        );

        if (endedSchedules.length === 0) {
          console.log(
            "[CRON] ⏳ Belum ada shift yang selesai, belum ada data ALPHA yang diproses.",
          );
          return;
        }

        if (endedSchedules.length > 0) {
          const totalKaryawan = endedSchedules.reduce(
            (acc, curr) => acc + curr.workingSchedule.employees.length,
            0,
          );
          console.log(`[DEBUG] Total karyawan di jadwal ini: ${totalKaryawan}`);
        }

        // 2. Kumpulkan ID Karyawan yang diwajibkan masuk hari ini
        // Kita pakai Map buat filter duplikat (kalau misal 1 orang masuk di 2 jadwal)
        // 2. Kumpulkan ID Karyawan yang diwajibkan masuk hari ini
        const expectedEmployees = new Map<string, any>();
        for (const scheduleDay of endedSchedules) {
          // emp = karyawan yang harusnya masuk hari ini berdasarkan jadwal kerja
          for (const emp of scheduleDay.workingSchedule.employees) {
            expectedEmployees.set(emp.id, {
              emp: emp,
              scheduleDay: scheduleDay,
            });
          }
        }

        // 3. Tarik data Absensi HARI INI (Siapa aja yang udah absen?)
        const todayAttendances = await prisma.attendances.findMany({
          where: {
            createdAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        });

        // Bikin Set ID Karyawan yang udah absen biar nyarinya O(1) alias cepet
        const attendedEmployeeIds = new Set(
          todayAttendances.map((a) => a.employeeId),
        );

        const employeeUserIds = Array.from(expectedEmployees.values())
          .map((item) => item?.emp?.userId)
          .filter(Boolean);

        const blockingSubmissionMap = await findBlockingSubmissionByUserIds(
          employeeUserIds,
          dayStart,
          dayEnd,
        );

        // 4. Komparasi: Siapa yang harusnya masuk tapi nggak ada di data absen?
        // 4. Komparasi: Siapa yang harusnya masuk tapi nggak ada di data absen?
        const alphaRecords: any[] = [];
        for (const empId of expectedEmployees.keys()) {
          const { emp, scheduleDay } = expectedEmployees.get(empId);

          // Pengecekan Edge Case: Karyawan belum join
          if (emp.joinDate > now) continue;

          if (!attendedEmployeeIds.has(empId)) {
            if (!emp.userId) {
              console.log(
                `[CRON] ⚠️ Skip Alpha untuk employee ${empId} karena userId tidak tersedia.`,
              );
              continue;
            }

            const blockingSubmission = emp.userId
              ? blockingSubmissionMap.get(emp.userId)
              : null;

            if (blockingSubmission) {
              console.log(
                `[CRON] 🟨 Skip Alpha untuk employee ${empId} karena ada pengajuan ${blockingSubmission.type} (${blockingSubmission.status}).`,
              );
              continue;
            }

            const baseShiftDate = new Date(
              `${dayKey}T00:00:00.000${JAKARTA_UTC_OFFSET}`,
            );

            // Konversi startTime ("08:00") ke bentuk DateTime utuh untuk hari ini
            // Contoh: "2026-03-08T08:00:00.000Z"
            const expectedCheckIn = new Date(baseShiftDate);
            const [startHour, startMin] =
              scheduleDay.shift.startTime.split(":");
            expectedCheckIn.setHours(Number(startHour), Number(startMin), 0, 0);

            // Konversi endTime ("17:00") ke bentuk DateTime utuh untuk hari ini
            const expectedCheckOut = new Date(baseShiftDate);
            const [endHour, endMin] = scheduleDay.shift.endTime.split(":");
            expectedCheckOut.setHours(Number(endHour), Number(endMin), 0, 0);

            // Cek apakah shift ini lintas hari? Kalau iya, checkoutnya besok
            if (scheduleDay.shift.isCrossDay) {
              expectedCheckOut.setDate(expectedCheckOut.getDate() + 1);
            }

            // Push dengan field lengkap sesuai schema lu
            alphaRecords.push({
              employeeId: empId,
              userId: emp.userId,
              userRole: emp.user?.rbacRole?.key || "USER",
              // date: new Date(), <--- KOLOM INI NGGAK ADA DI SCH\EMA LU (Jadi gue hapus)
              status: "ABSENT",

              // 🔥 TAMBAHAN SNAPSHOT WAJIB SESUAI ERROR TYPESCRIPT 🔥
              shiftNameSnapshot: scheduleDay.shift.name,
              expectedCheckInSnapshot: expectedCheckIn,
              expectedCheckOutSnapshot: expectedCheckOut,

              // Kolom checkIn & checkOut real dibiarin null karena emang dia bolos
            });
          }
        }

        // 5. Eksekusi insert data alpha + trigger aturan poin penalti absensi.
        if (alphaRecords.length > 0) {
          const createdAttendances: Array<{
            id: string;
            userId: string;
            userRole: string;
          }> = [];

          for (const record of alphaRecords) {
            const created = await prisma.attendances.create({
              data: {
                employeeId: record.employeeId,
                status: record.status,
                shiftNameSnapshot: record.shiftNameSnapshot,
                expectedCheckInSnapshot: record.expectedCheckInSnapshot,
                expectedCheckOutSnapshot: record.expectedCheckOutSnapshot,
              },
              select: { id: true },
            });

            createdAttendances.push({
              id: created.id,
              userId: record.userId,
              userRole: record.userRole,
            });
          }

          for (const item of createdAttendances) {
            await PointsService.applyAttendanceRules({
              userId: item.userId,
              role: item.userRole,
              attendanceId: item.id,
              source: "CRON_ABSENT",
              actor: SYSTEM_ACTOR,
              context: {
                attendanceStatus: "ABSENT",
                isAbsent: true,
                isLate: false,
              },
            });
          }

          console.log(
            `[CRON] ✅ Berhasil mencatat ${alphaRecords.length} karyawan ALPHA (Bolos).`,
          );
        } else {
          console.log(
            "[CRON] ✨ Semua karyawan masuk hari ini. Tidak ada ALPHA.",
          );
        }
      } catch (error) {
        console.error("[CRON] ❌ Gagal mengeksekusi pengecekan Alpha:", error);
      }
    },
  }),
);
