// * File ini adalah facade orchestrator untuk module auth.

import { authenticateUser } from "./create";
import { me } from "./report";

export const AuthService = {
  // & Authenticate user credentials.
  // % Autentikasi kredensial user.
  authenticateUser,

  // & Fetch current authenticated user profile.
  // % Ambil profil user terautentikasi saat ini.
  me,
};
