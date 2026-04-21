// * Backend module: karyawan-be/src/utils/geo.ts
// & This file defines backend logic for geo.ts.
// % File ini mendefinisikan logika backend untuk geo.ts.

// Konversi derajat ke radian
const deg2rad = (deg: number): number => deg * (Math.PI / 180);

/** Mengekspor calculateDistanceInMeters untuk kebutuhan modul ini. */
export const calculateDistanceInMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Radius bumi dalam satuan meter (konstanta fisika)
  const dLat = deg2rad(lat2 - lat1); // selisih koordinat lintang dalam radian 
  const dLon = deg2rad(lon2 - lon1); // selisih koordinat bujur dalam radian 

  // haversine formula: https://en.wikipedia.org/wiki/Haversine_formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  // Math.atan2 sangat akurat untuk menghitung jarak pendek (radius presensi)
  // hitung sudut sentral antara dua titik artinya berapa "banyak" lingkaran bumi yang harus ditempuh untuk mencapai titik kedua (biar inget aja, ini bukan jarak sebenarnya, tapi proporsi dari keliling bumi)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // jarak sebenarnya dalam meter, dengan mengalikan proporsi lingkaran bumi (c) dengan radius bumi (R)
  // jarak = Radius Bumi (R) * Sudut Sentral (c)
  return R * c; // Hasil akhir dalam meter
};