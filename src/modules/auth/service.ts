import { argon2id, verify } from "argon2";
import prisma from "../../config/prisma";
import { LoginPayload } from "./model";

export const AuthService = {
  async authenticateUser(data: LoginPayload) {
    const user = await prisma.users.findUnique({
      where: { nip: data.nip },
    });

    if (!user) throw new Error("Bad Request: NIP atau Password salah.");

    // verifikasi hash cryptography
    const isPasswordValid = await verify(user.password, data.password);
    if (!isPasswordValid) throw new Error("Bad Request: NIP atau Password salah.");

    // gate keeper: klo akses dari web tapi dia bkn admin, drop it
    if (data.clientType === "WEB" && !["ADMIN", "CEO", "MANAGER", "HR"].includes(user.role)) {
      throw new Error("Forbidden: Akses Web Portal hanya diperuntukkan untuk Administrator.");
    }

    return {
      id: user.id,
      role: user.role
    }
  },
};
