// * Backend module service: src/modules/auth/service.ts

import { authenticateUser } from "./services/authenticateUser.service";
import { sendCode } from "./services/sendCode.service";
import { forgotPassword } from "./services/forgotPassword.service";
import { verifyCode } from "./services/verifyCode.service";
import { resetPassword } from "./services/resetPassword.service";
import { me } from "./services/me.service";

export const AuthService = {
  authenticateUser,
  sendCode,
  forgotPassword,
  verifyCode,
  resetPassword,
  me,
};
