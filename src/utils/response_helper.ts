
/**
 * Helper untuk swagger documentation
 */
export const swaggerDetails = (title: string, description?: string) => {
  return { summary: title, description };
};

/**
 * Standard API response wrapper
 */
export const apiResponse = <T>(data: T, message?: string) => {
  return {
    success: true as const,
    data,
    message,
  };
};

/**
 * Paginated response wrapper
 */
export const paginatedResponse = <T>(
  data: T[],
  pagination: { total: number; count: number; page: number }
) => {
  return {
    success: true as const,
    data,
    meta: {
      total: pagination.total,
      count: pagination.count,
      page: pagination.page,
    },
  };
};

/**
 * Error response wrapper
 */
/**
 * Standard success response wrapper.
 * - `data`    : payload utama yang dikembalikan ke client
 * - `message` : pesan deskriptif (opsional)
 * - `meta`    : informasi paginasi { total, page, limit, totalPages } (opsional)
 * - `stats`   : data agregat/kartu statistik tambahan, misal pada laporan penilaian (opsional)
 *
 * Field `stats` dipisah dari `data` agar frontend bisa membedakan antara
 * "baris tabel" (data) dan "kartu ringkasan" (stats) tanpa perlu parsing nested object.
 */
export const successResponse = ({
  data,
  message,
  meta,
  stats,
}: {
  data?: any;
  message?: string;
  meta?: any;
  stats?: any; // Angka agregat: totalPenilaian, rataRata, tertinggi, terendah, dst.
}) => {
  return {
    success: true as const,
    data,
    message,
    error: null,
    meta,
    // stats hanya disertakan dalam respons jika benar-benar dikirim (tidak undefined),
    // sehingga endpoint yang tidak punya stats tidak mencetak field "stats: undefined"
    ...(stats !== undefined && { stats }),
  };
};

/**
 * Error response wrapper
 */
export const errorResponse = (message: string, error?: string) => {
  return {
    success: false as const,
    message,
    error,
  };
};


/**
 * Get Error from catch
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}