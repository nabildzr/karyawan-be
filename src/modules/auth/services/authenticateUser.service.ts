// * File ini menangani autentikasi user untuk module auth.

import { AuthService as LegacyAuthService } from "../legacy";

// & Authenticate user credentials and issue token.
// % Autentikasi kredensial user dan keluarkan token.
export const authenticateUser = LegacyAuthService.authenticateUser;