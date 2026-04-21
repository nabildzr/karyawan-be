import { t } from "elysia";

const FaceImageFileDTO = t.File({
  type: ["image/jpeg", "image/png"],
  maxSize: 5 * 1024 * 1024,
});

/** Mengekspor FaceRegisterBodyDTO untuk kebutuhan modul ini. */
export const FaceRegisterBodyDTO = t.Object({
  image: FaceImageFileDTO,
});

/** Mengekspor FaceAdminRegisterBodyDTO untuk kebutuhan modul ini. */
export const FaceAdminRegisterBodyDTO = t.Object({
  userId: t.String(),
  image: FaceImageFileDTO,
});

/** Mengekspor FaceAdminUserParamsDTO untuk kebutuhan modul ini. */
export const FaceAdminUserParamsDTO = t.Object({
  userId: t.String(),
});

/** Mengekspor FaceAdminListQueryDTO untuk kebutuhan modul ini. */
export const FaceAdminListQueryDTO = t.Object({
  page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
  limit: t.Optional(t.Numeric({ default: 10, minimum: 1 })),
  search: t.Optional(t.String({ default: "" })),
});

/** Mengekspor FaceUserRoleDTO untuk kebutuhan modul ini. */
export const FaceUserRoleDTO = t.Object({
  key: t.String(),
});

/** Mengekspor FaceUserEmployeeDTO untuk kebutuhan modul ini. */
export const FaceUserEmployeeDTO = t.Object({
  fullName: t.String(),
  email: t.Union([t.String(), t.Null()]),
});

/** Mengekspor FaceUserDTO untuk kebutuhan modul ini. */
export const FaceUserDTO = t.Object({
  id: t.String(),
  nip: t.String(),
  rbacRole: t.Union([FaceUserRoleDTO, t.Null()]),
  employees: t.Union([FaceUserEmployeeDTO, t.Null()]),
  role: t.String(),
});

/** Mengekspor FaceDTO untuk kebutuhan modul ini. */
export const FaceDTO = t.Object({
  userId: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
  user: FaceUserDTO,
});

/** Mengekspor FaceListMetaDTO untuk kebutuhan modul ini. */
export const FaceListMetaDTO = t.Object({
  total: t.Number(),
  page: t.Number(),
  limit: t.Number(),
  totalPages: t.Number(),
});

/** Mendefinisikan alias tipe untuk FaceRegisterBodyPayload. */
export type FaceRegisterBodyPayload = typeof FaceRegisterBodyDTO.static;

/** Mendefinisikan alias tipe untuk FaceAdminRegisterBodyPayload. */
export type FaceAdminRegisterBodyPayload = typeof FaceAdminRegisterBodyDTO.static;

/** Mendefinisikan alias tipe untuk FaceAdminUserParamsPayload. */
export type FaceAdminUserParamsPayload = typeof FaceAdminUserParamsDTO.static;

/** Mendefinisikan alias tipe untuk FaceAdminListQueryPayload. */
export type FaceAdminListQueryPayload = typeof FaceAdminListQueryDTO.static;

/** Mendefinisikan alias tipe untuk FaceUserRolePayload. */
export type FaceUserRolePayload = typeof FaceUserRoleDTO.static;

/** Mendefinisikan alias tipe untuk FaceUserEmployeePayload. */
export type FaceUserEmployeePayload = typeof FaceUserEmployeeDTO.static;

/** Mendefinisikan alias tipe untuk FaceUserPayload. */
export type FaceUserPayload = typeof FaceUserDTO.static;

/** Mendefinisikan alias tipe untuk FacePayload. */
export type FacePayload = typeof FaceDTO.static;

/** Mendefinisikan alias tipe untuk FaceListMetaPayload. */
export type FaceListMetaPayload = typeof FaceListMetaDTO.static;
