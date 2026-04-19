// * File ini menangani verifikasi kode reset password.

import { VerifyCodePayload } from "../model";
import { resolveResetUserFromTokenAndCode } from "./utils";

// & Verify reset code before password reset.
// % Verifikasi kode reset sebelum reset password.
export async function verifyCode(data: VerifyCodePayload) {
  await resolveResetUserFromTokenAndCode(data.token, data.code);

  return {
    isValid: true,
  };
}