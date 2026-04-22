// * File ini berisi implementasi service module submissions.

import { DEFAULT_TIMEZONE } from "../../config/timezone";
import { findFirstInvalidScheduleDateInRange } from "../../shared/attendances/schedules";
import type { AuditActor } from "../../shared/audit/actor";
import { writeAuditLog } from "../../shared/audit/writeAudit";
import {
  deleteSubmissionAttachment,
  uploadSubmissionAttachment,
} from "./attachment.service";
import type {
  SubmissionsCreatePayload,
  SubmissionStatusUpdatePayload,
} from "./submissions.schema";
import { SubmissionsRepository } from "./submissions.repository";
import {
  buildSearchFilter,
  REJECTED_DELETE_WINDOW_MS,
  type SubmissionListParams,
  toEndOfDay,
  toScheduleConflictMessage,
  toStartOfDay,
} from "./utils";

const prisma = SubmissionsRepository.db;

/** Mengekspor SubmissionService untuk kebutuhan modul ini. */
export const SubmissionService = {
  async getAll(params: SubmissionListParams = {}) {
    const { page = 1, limit = 20, status, type, search } = params;

    const skip = (page - 1) * limit;

    const where: any = {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(buildSearchFilter(search) ?? {}),
    };

    const [data, total] = await Promise.all([
      prisma.submissions.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              nip: true,
              rbacRole: { select: { key: true } },
              employees: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.submissions.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  },

  async getMine(
    userId: string,
    params: Pick<
      SubmissionListParams,
      "page" | "limit" | "status" | "type"
    > = {},
  ) {
    const { page = 1, limit = 20, status, type } = params;
    const skip = (page - 1) * limit;

    const userExists = await prisma.users.findUnique({ where: { id: userId } });
    if (!userExists) {
      throw new Error(
        "Not Found: Pengguna dengan ID tersebut tidak ditemukan.",
      );
    }

    const where: any = {
      userId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.submissions.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.submissions.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  },

  async getDetailById(
    submissionId: string,
    actor: { userId: string; isAdmin: boolean },
  ) {
    const submission = await prisma.submissions.findFirst({
      where: {
        id: submissionId,
        ...(actor.isAdmin ? {} : { userId: actor.userId }),
      },
      include: {
        user: {
          select: {
            id: true,
            nip: true,
            rbacRole: { select: { key: true } },
            employees: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!submission) {
      throw new Error("Not Found: Data pengajuan tidak ditemukan.");
    }

    return submission;
  },

  async create(
    userId: string,
    payload: SubmissionsCreatePayload,
    actor: AuditActor,
  ) {
    const employee = await prisma.employees.findFirst({
      where: { userId },
      include: {
        workingSchedules: {
          include: {
            days: {
              include: { shift: true },
            },
          },
        },
      },
    });

    if (!employee) {
      throw new Error(
        "Not Found: Pengguna dengan ID tersebut tidak ditemukan.",
      );
    }

    if (!payload.reason?.trim()) {
      throw new Error("Bad Request: Alasan pengajuan wajib diisi.");
    }

    const startDate = toStartOfDay(payload.startDate);
    const endDate = toEndOfDay(payload.endDate);

    if (startDate > endDate) {
      throw new Error(
        "Bad Request: Tanggal mulai tidak boleh melebihi tanggal selesai.",
      );
    }

    const scheduleValidationIssue = findFirstInvalidScheduleDateInRange(
      employee.workingSchedules?.days ?? [],
      startDate,
      endDate,
      DEFAULT_TIMEZONE,
    );

    if (scheduleValidationIssue) {
      throw new Error(toScheduleConflictMessage(scheduleValidationIssue));
    }

    const overlapping = await prisma.submissions.findFirst({
      where: {
        userId,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: {
        id: true,
        type: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    if (overlapping) {
      throw new Error(
        "Conflict: Anda sudah memiliki pengajuan aktif pada rentang tanggal tersebut.",
      );
    }

    // ? cek apakah sedang dalam hari libur
    const isHoliday = await prisma.publicHolidays.findFirst({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    if (isHoliday) {
      throw new Error(
        `Conflict: Tanggal ${isHoliday.date.toISOString().split("T")[0]} adalah hari libur (${isHoliday.name}). Pengajuan tidak dapat dibuat pada rentang tanggal yang mencakup hari libur.`,
      );
    }

    // ? cek apakah sudah check-in atau check-out pada hari yang diajukan (untuk jenis tertentu)
    const hasAttendance = await prisma.attendances.findFirst({
      where: {
        employeeId: employee.id,
        OR: [
          {
            checkIn: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            checkOut: {
              gte: startDate,
              lte: endDate,
            },
          },
        ],
      },
    });

    if (hasAttendance) {
      throw new Error(
        "Conflict: Anda sudah melakukan absensi pada hari yang termasuk dalam rentang tanggal pengajuan. Pengajuan tidak dapat dibuat.",
      );
    }

    // ? cek apakah jenis pengajuan memungkinkan untuk diajukan pada hari yang sudah lewat
    const now = new Date();
    if (["IZIN_SAKIT", "IZIN_KHUSUS"].includes(payload.type) && endDate < now) {
      throw new Error(
        "Conflict: Jenis pengajuan Izin Sakit dan Izin Khusus tidak dapat diajukan untuk tanggal yang sudah lewat.",
      );
    }

    let uploadedAttachment: {
      url: string;
      publicId: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    } | null = null;
    let submissionWasCreated = false;

    try {
      if (payload.attachmentFile) {
        uploadedAttachment = await uploadSubmissionAttachment(
          payload.attachmentFile,
          userId,
        );
      }

      const newSubmission = await prisma.submissions.create({
        data: {
          userId,
          type: payload.type as any,
          startDate,
          endDate,
          reason: payload.reason.trim(),
          attachment: uploadedAttachment?.url ?? null,
          attachmentPublicId: uploadedAttachment?.publicId ?? null,
          attachmentOriginalName: uploadedAttachment?.originalName ?? null,
          attachmentMimeType: uploadedAttachment?.mimeType ?? null,
          attachmentSizeBytes: uploadedAttachment?.sizeBytes ?? null,
        },
      });
      submissionWasCreated = true;

      try {
        await writeAuditLog({
          actor,
          action: "CREATE_SUBMISSION",
          entity: "Submissions",
          entityId: newSubmission.id,
          changes: {
            before: null,
            after: {
              type: newSubmission.type,
              startDate: newSubmission.startDate,
              endDate: newSubmission.endDate,
              status: newSubmission.status,
              attachment: newSubmission.attachment,
              attachmentPublicId: newSubmission.attachmentPublicId,
            },
          },
          reason: "Pengajuan baru dibuat oleh karyawan.",
        });
      } catch (auditError) {
        console.error(
          "Failed to write CREATE_SUBMISSION audit log:",
          auditError,
        );
      }

      return newSubmission;
    } catch (error) {
      if (!submissionWasCreated && uploadedAttachment?.publicId) {
        try {
          await deleteSubmissionAttachment(uploadedAttachment.publicId);
        } catch (cleanupError) {
          console.error(
            "Failed to cleanup uploaded attachment after submission creation error:",
            cleanupError,
          );
        }
      }

      throw error;
    }
  },

  async deleteById(id: string, actor: AuditActor) {
    const existing = await prisma.submissions.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Not Found: Data pengajuan tidak ditemukan.");
    }

    if (existing.userId === actor.id) {
      throw new Error(
        "Forbidden: Anda tidak dapat menghapus pengajuan milik sendiri.",
      );
    }

    if (existing.status !== "REJECTED") {
      throw new Error(
        "Forbidden: Hanya pengajuan dengan status REJECTED yang dapat dihapus.",
      );
    }

    const rejectedAtMs = new Date(existing.updatedAt).getTime();
    if (Number.isNaN(rejectedAtMs)) {
      throw new Error("Conflict: Waktu penolakan pengajuan tidak valid.");
    }

    const elapsedMs = Date.now() - rejectedAtMs;
    if (elapsedMs > REJECTED_DELETE_WINDOW_MS) {
      throw new Error(
        "Conflict: Pengajuan hanya dapat dihapus dalam 48 jam setelah ditolak.",
      );
    }

    if (existing.attachmentPublicId) {
      try {
        await deleteSubmissionAttachment(existing.attachmentPublicId);
      } catch (error) {
        console.error("Cloudinary cleanup failed on submission delete:", error);
        throw new Error(
          "Conflict: Gagal menghapus lampiran dari Cloudinary. Data pengajuan tidak dihapus.",
        );
      }
    }

    const deleted = await prisma.submissions.delete({ where: { id } });

    try {
      await writeAuditLog({
        actor,
        action: "DELETE_SUBMISSION",
        entity: "Submissions",
        entityId: id,
        changes: {
          before: {
            id: existing.id,
            userId: existing.userId,
            status: existing.status,
            type: existing.type,
            startDate: existing.startDate,
            endDate: existing.endDate,
            attachment: existing.attachment,
            attachmentPublicId: existing.attachmentPublicId,
          },
          after: null,
        },
      });
    } catch (auditError) {
      console.error("Failed to write DELETE_SUBMISSION audit log:", auditError);
    }

    return deleted;
  },

  async updateStatus(
    payload: SubmissionStatusUpdatePayload,
    id: string,
    adminId: string,
    adminRole: string,
  ) {
    const { status, rejectionReason } = payload;

    const existing = await prisma.submissions.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Not Found: Data pengajuan tidak ditemukan.");
    }

    if (existing.userId === adminId) {
      throw new Error(
        "Forbidden: Anda tidak dapat memproses pengajuan milik sendiri.",
      );
    }

    if (existing.status !== "PENDING") {
      throw new Error(
        "Conflict: Pengajuan ini sudah diproses dan tidak dapat diubah lagi.",
      );
    }

    if (
      status === "REJECTED" &&
      (!rejectionReason || rejectionReason.trim() === "")
    ) {
      throw new Error("Bad Request: Alasan penolakan wajib diisi.");
    }

    const updatedSubmission = await prisma.submissions.update({
      where: { id },
      data: {
        status,
        rejectionReason: status === "REJECTED" ? rejectionReason?.trim() : null,
      },
      include: {
        user: {
          select: {
            id: true,
            nip: true,
            rbacRole: { select: { key: true } },
            employees: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    await writeAuditLog({
      actor: {
        id: adminId,
        role: adminRole,
      },
      action:
        status === "APPROVED" ? "APPROVE_SUBMISSION" : "REJECT_SUBMISSION",
      entity: "Submissions",
      entityId: id,
      changes: {
        before: {
          status: existing.status,
          rejectionReason: existing.rejectionReason,
        },
        after: {
          status,
          rejectionReason:
            status === "REJECTED" ? rejectionReason?.trim() : null,
        },
      },
      reason: status === "REJECTED" ? rejectionReason?.trim() : undefined,
    });

    return updatedSubmission;
  },

  // & Tarik kembali pengajuan oleh karyawan yang mengajukan
  async retract(id: string, userId: string) {
    const existing = await prisma.submissions.findUnique({ where: { id } });
    
    // ^ validasi data pengajuan
    if (!existing) {
      throw new Error("Not Found: Data pengajuan tidak ditemukan.");
    }

    // ^ Hanya bisa menarik kembali pengajuan milik sendiri
    if (existing.userId !== userId) {
      throw new Error(
        "Forbidden: Anda hanya dapat menarik kembali pengajuan milik sendiri.",
      );
    }

    // ^ Hanya pengajuan dengan status PENDING yang bisa ditarik kembali
    if (existing.status !== "PENDING") {
      throw new Error(
        "Conflict: Hanya pengajuan dengan status PENDING yang dapat ditarik kembali.",
      );
    }

    // ? hapus saja data pengajuan, karena belum diproses sama sekali
    const deleted = await prisma.submissions.delete({ where: { id } });

    // ? hapus attachment jika ada
    if (existing.attachmentPublicId) {
      try {
        await deleteSubmissionAttachment(existing.attachmentPublicId);
      }
      catch (error) {
        console.error("Cloudinary cleanup failed on submission retract:", error);
        // ? tidak menggagalkan proses tarik kembali meskipun terjadi error saat hapus lampiran, karena data pengajuan sudah dihapus dari database
      }
    }
    
    try {
      await writeAuditLog({
        actor: {
          id: userId,
          role: "EMPLOYEE",
        },
        action: "RETRACT_SUBMISSION",
        entity: "Submissions",
        entityId: id,
        changes: {
          before: {
            status: existing.status,
            type: existing.type,
            startDate: existing.startDate,
            endDate: existing.endDate,
          },
          after: null,
        },
        reason: "Pengajuan ditarik kembali oleh karyawan sebelum diproses.",
      });
    }
    catch (auditError) {
      console.error("Failed to write RETRACT_SUBMISSION audit log:", auditError);
    }
    
    return deleted;
  }
};
