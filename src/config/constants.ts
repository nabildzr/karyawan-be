export const constants = {
  server: {
    name: "Karyawan Backend",
    author: "Your Name",
    version: "1.0.0",
    email: "info@example.com",
  },
  api: {
    versionPrefix: "/v",
    version: 1,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || "your-secret-key",
    jwtMaxAge: 7, // days
    passwordMinLength: 8,
  },
  pagination: {
    defaultLimit: 25,
    maxLimit: 100,
  },
};

export const RedisKeys = {
  USER: (userId: string) => `user:${userId}`,
  USERS: "users",
  EMPLOYEE: (id: string) => `employee:${id}`,
  EMPLOYEES: "employees",
};
