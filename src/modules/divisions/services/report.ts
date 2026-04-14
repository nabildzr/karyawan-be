// * File ini menangani operasi baca/report untuk module divisions.

import { DivisionRepository } from "../repository";

// & Get all divisions by relation flags.
// % Ambil semua divisi berdasarkan flag relasi.
export async function getAll({
  withPositions = false,
  withManager = false,
  withEmployees = false,
}: {
  withPositions?: boolean;
  withManager?: boolean;
  withEmployees?: boolean;
} = {}) {
  return DivisionRepository.findAllDivisions({
    withPositions,
    withManager,
    withEmployees,
  });
}

// & Get division detail by id and relation flags.
// % Ambil detail divisi berdasarkan id dan flag relasi.
export async function getById(
  id: string,
  {
    withPositions = false,
    withManager = false,
    withEmployees = false,
  }: {
    withPositions?: boolean;
    withManager?: boolean;
    withEmployees?: boolean;
  } = {},
) {
  const division = await DivisionRepository.findDivisionById(id, {
    withPositions,
    withManager,
    withEmployees,
  });

  if (!division) {
    throw new Error("Not Found: Divisi dengan ID tersebut tidak ditemukan.");
  }

  return division;
}
