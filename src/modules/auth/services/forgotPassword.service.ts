// * File ini menangani alias legacy endpoint forgot-password.

import { ForgotPasswordPayload } from "../model";
import { sendResetCodeByIdentifier } from "./utils";

// & Generate reset password token from NIP/email identifier.
// % Generate token reset password dari identifier NIP/email.
export async function forgotPassword(data: ForgotPasswordPayload) {
  return sendResetCodeByIdentifier(data.identifier);
}