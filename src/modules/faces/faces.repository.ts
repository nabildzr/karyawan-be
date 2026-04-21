import prisma from "../../config/prisma";
import type { Prisma, UserFaces, Users } from "../../generated/prisma/client";

/** Mendefinisikan alias tipe untuk FaceRecord. */
export type FaceRecord = {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    nip: string;
    rbacRole: { key: string } | null;
    employees: {
      fullName: string;
      email: string | null;
    } | null;
  };
};

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
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.UserFacesSelect;

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
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.UserFacesSelect;

/** Mengambil data user mentah berdasarkan id. */
export async function findUserById(userId: string): Promise<Users | null> {
  return prisma.users.findUnique({ where: { id: userId } });
}

/** Mengambil data wajah mentah berdasarkan user id. */
export async function findFaceByUserId(userId: string): Promise<UserFaces | null> {
  return prisma.userFaces.findUnique({ where: { userId } });
}

/** Mengambil daftar wajah mentah dengan paginasi dan filter pencarian. */
export async function findFaces(params: {
  skip: number;
  take: number;
  where?: Prisma.UserFacesWhereInput;
}): Promise<FaceRecord[]> {
  return prisma.userFaces.findMany({
    skip: params.skip,
    take: params.take,
    where: params.where,
    select: faceListSelect,
    orderBy: { createdAt: "desc" },
  }) as Promise<FaceRecord[]>;
}

/** Menghitung total data wajah mentah berdasarkan filter pencarian. */
export async function countFaces(where?: Prisma.UserFacesWhereInput): Promise<number> {
  return prisma.userFaces.count({ where });
}

/** Mengambil detail wajah mentah berdasarkan user id. */
export async function findFaceDetailByUserId(
  userId: string,
): Promise<FaceRecord | null> {
  return prisma.userFaces.findUnique({
    where: { userId },
    select: faceDetailSelect,
  }) as Promise<FaceRecord | null>;
}

/** Membuat data wajah mentah baru ke database. */
export async function createFace(
  data: Prisma.UserFacesUncheckedCreateInput,
): Promise<UserFaces> {
  return prisma.userFaces.create({
    data,
  });
}

/** Memperbarui data wajah mentah berdasarkan user id. */
export async function updateFace(
  userId: string,
  data: Prisma.UserFacesUncheckedUpdateInput,
): Promise<UserFaces> {
  return prisma.userFaces.update({
    where: { userId },
    data,
  });
}

/** Menghapus data wajah mentah berdasarkan user id. */
export async function deleteFace(userId: string): Promise<UserFaces> {
  return prisma.userFaces.delete({ where: { userId } });
}
