// * File ini menangani operasi baca/report untuk module auth.

import { AuthService as LegacyAuthService } from "../legacy";

// & Get authenticated user profile context.
// % Ambil konteks profil user yang terautentikasi.
export const me = LegacyAuthService.me;