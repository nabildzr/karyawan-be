// * File ini menangani pengiriman kode verifikasi reset password.

import { SendCodePayload } from "../model";
import { sendResetCodeByIdentifier } from "./utils";

// & Send verification code for forgot password flow.
// % Kirim kode verifikasi untuk alur lupa password.
export async function sendCode(data: SendCodePayload) {
  return sendResetCodeByIdentifier(data.identifier);
}