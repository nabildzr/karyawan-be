// * This file centralizes external Face Process API endpoint configurations for the Karyawan backend.

// & Define the default Flask face matching API endpoint URL for local development.
// % Mendefinisikan URL endpoint API pencocokan wajah Flask default untuk pengembangan lokal.
/** Mengekspor FLASK_MATCH_URL untuk kebutuhan modul ini. */
export const FLASK_MATCH_URL =
  process.env.FLASK_MATCH_URL || "http://127.0.0.1:5000/v1/faces/match";
