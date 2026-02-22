
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