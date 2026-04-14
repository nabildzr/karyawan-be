// * File ini menangani operasi baca/report untuk module positions.

import { PositionRepository } from "../repository";

// & Get position list by relation flags.
// % Ambil daftar posisi berdasarkan flag relasi.
export async function getAll({
  withDivision = false,
  withEmployees = false,
}: {
  withDivision?: boolean;
  withEmployees?: boolean;
}) {
  return PositionRepository.findAllPositions({ withDivision, withEmployees });
}

// & Get position detail by id and relation flags.
// % Ambil detail posisi berdasarkan id dan flag relasi.
export async function getById(
  id: string,
  {
    withDivision = false,
    withEmployees = false,
  }: { withDivision?: boolean; withEmployees?: boolean },
) {
  const position = await PositionRepository.findPositionById(id, {
    withDivision,
    withEmployees,
  });

  if (!position) {
    throw new Error("Not Found: Posisi dengan ID tersebut tidak ditemukan.");
  }

  return position;
}
