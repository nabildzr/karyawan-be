import { PermissionAction } from "../../../generated/prisma/enums";

export const CRUD_ACTIONS: PermissionAction[] = [
  PermissionAction.CREATE,
  PermissionAction.READ,
  PermissionAction.UPDATE,
  PermissionAction.DELETE,
];

export const BULK_PERMISSION_UPDATE_CHUNK_SIZE = 200;

export function normalizeRoleKey(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function resourceActions(supportsApprove: boolean) {
  return supportsApprove
    ? [...CRUD_ACTIONS, PermissionAction.APPROVE]
    : CRUD_ACTIONS;
}

export function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}