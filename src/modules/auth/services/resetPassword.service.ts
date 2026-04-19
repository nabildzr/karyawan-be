// * File ini menangani reset password menggunakan token + kode verifikasi.

import { hash, verify } from "argon2";
import { constants } from "../../../config/constants";
import { ResetPasswordPayload } from "../model";
import { AuthRepository } from "../repository";
import { resolveResetUserFromTokenAndCode } from "./utils";

// & Reset password using one-time reset token.
// % Reset password menggunakan token reset sekali pakai.
export async function resetPassword(data: ResetPasswordPayload) {
  if (data.newPassword !== data.confirmPassword) {
    throw new Error("Bad Request: Konfirmasi password tidak sesuai.");
  }

  if (data.newPassword.length < constants.auth.passwordMinLength) {
    throw new Error(
      `Bad Request: Password minimal ${constants.auth.passwordMinLength} karakter.`,
    );
  }

  const db = AuthRepository.getClient();
  const user = await resolveResetUserFromTokenAndCode(data.token, data.code);

  const isSamePassword = await verify(user.password, data.newPassword);
  if (isSamePassword) {
    throw new Error(
      "Bad Request: Password baru tidak boleh sama dengan password lama.",
    );
  }

  const hashedPassword = await hash(data.newPassword);
  await db.users.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return {
    updated: true,
  };
}