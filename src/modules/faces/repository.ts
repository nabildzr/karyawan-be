// * Repository ini menjadi lapisan akses database untuk module faces.

import prisma from "../../config/prisma";

const faceListSelect = {
  userId: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      nip: true,
      rbacRole: { select: { key: true } },
      employees: {
        select: { fullName: true, email: true },
      },
    },
  },
};

const faceDetailSelect = {
  userId: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      nip: true,
      rbacRole: { select: { key: true } },
      employees: {
        select: { fullName: true, email: true },
      },
    },
  },
};

export const FaceRepository = {
  // & Find user by id.
  // % Cari user berdasarkan id.
  async findUserById(userId: string) {
    return prisma.users.findUnique({ where: { id: userId } });
  },

  // & Find user face by user id.
  // % Cari data wajah user berdasarkan user id.
  async findFaceByUserId(userId: string) {
    return prisma.userFaces.findUnique({ where: { userId } });
  },

  // & Create user face row.
  // % Buat baris data wajah user.
  async createFace(userId: string, faceData: Buffer) {
    return prisma.userFaces.create({
      data: {
        userId,
        faceData: Uint8Array.from(faceData),
      },
    });
  },

  // & Update user face row.
  // % Update baris data wajah user.
  async updateFace(userId: string, faceData: Buffer) {
    return prisma.userFaces.update({
      where: { userId },
      data: { faceData: Uint8Array.from(faceData) },
    });
  },

  // & Delete user face by user id.
  // % Hapus data wajah user berdasarkan user id.
  async deleteFace(userId: string) {
    return prisma.userFaces.delete({ where: { userId } });
  },

  // & Find paginated face list with optional search filter.
  // % Ambil daftar wajah paginasi dengan filter pencarian opsional.
  async findFaces(params: { where: any; skip: number; take: number }) {
    return prisma.userFaces.findMany({
      skip: params.skip,
      take: params.take,
      where: params.where,
      select: faceListSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  // & Count face rows by filter.
  // % Hitung jumlah data wajah berdasarkan filter.
  async countFaces(where: any) {
    return prisma.userFaces.count({ where });
  },

  // & Find face detail by user id.
  // % Ambil detail data wajah berdasarkan user id.
  async findFaceDetailByUserId(userId: string) {
    return prisma.userFaces.findUnique({
      where: { userId },
      select: faceDetailSelect,
    });
  },
};
