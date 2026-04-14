/**
 * Format date ke ISO string
 */
export const formatDate = (date: Date): string => {
  return date.toISOString();
};

/**
 * Validasi apakah email valid (mengandung @ dan .)
 */
export const isValidEmail = (email: string): boolean => {
  // regex = mendeteksi pola email yang umum (bukan validasi sempurna, tapi cukup untuk basic check)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validasi apakah nomor telepon valid (hanya angka)
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\d+$/;
  return phoneRegex.test(phone);
};

/**
 * Sleep helper untuk async operations
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Check apakah string adalah valid UUID
 */
export const isValidUUID = (str: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/**
 * Capitalize first letter
 */
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Remove sensitive fields from object

export const sanitizeObject = <T extends Record<string, any>>(
  obj: T,
  fieldsToRemove: string[]
): Partial<T> => {
  const sanitized = { ...obj };
  fieldsToRemove.forEach((field) => {
    delete sanitized[field];
  });
  return sanitized;
};





/**
 * Hitung jarak antara dua titik koordinat menggunakan formula Haversine.
 * Buat ngecek lo absen dari mana, beneran di kantor apa ngakalin dari rumah 😏
 * @returns jarak dalam meter
 */
export const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  // Ini radius bumi, 6.371 km = 6.371.000 meter
  const R = 6371000;

  // Helper buat convert derajat ke radian, soalnya Math.sin/cos maunya radian doang
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Selisih latitude sama longitude, udah diconvert ke radian biar bisa diitung
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  // Rumus haversine, intinya ngitung "seberapa jauh sih u dari titik target"
  // Pake sin kuadrat biar hasilnya selalu positif, terus dikali cos latitude biar akurat di semua posisi bumi
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  // Hitung sudut sentral pake atan2, lebih akurat daripada asin buat jarak deket
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Radius bumi x sudut = jarak dalam meter. Gas kelar!
  return R * c;
};

/**
 * Transform gajiPokok to number in position object
 */
export const transformPosition = <T extends { position?: { gajiPokok: any } | null }>(
  data: T
) => ({
  ...data,
  position: data.position
    ? { ...data.position, gajiPokok: Number(data.position.gajiPokok) }
    : undefined,
});