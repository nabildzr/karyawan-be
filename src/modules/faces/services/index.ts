// * File ini adalah facade orchestrator untuk module faces.

import { deleteFace, registerFace, updateFace } from "./create";
import { getAllFaces, getFaceByUserId, isFaceRegistered } from "./report";

export const FaceService = {
  // & Register face for user.
  // % Daftarkan wajah untuk user.
  registerFace,

  // & Update face for user.
  // % Perbarui wajah untuk user.
  updateFace,

  // & Check face registration status.
  // % Cek status registrasi wajah.
  isFaceRegistered,

  // & Get all faces with pagination.
  // % Ambil semua data wajah dengan paginasi.
  getAllFaces,

  // & Get face detail by user id.
  // % Ambil detail wajah berdasarkan user id.
  getFaceByUserId,

  // & Delete face by user id.
  // % Hapus wajah berdasarkan user id.
  deleteFace,
};
