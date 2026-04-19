// * Backend module: karyawan-be/src/modules/auth/model.ts
// & This file defines backend logic for model.ts.
// % File ini mendefinisikan logika backend untuk model.ts.

import { t } from "elysia";

export const LoginDTO = t.Object({
  nip: t.String(),
  password: t.String(),
  clientType: t.Union([t.Literal("WEB"), t.Literal("MOBILE")], {
    description: "Type of client logging in (web or mobile)",
  }),
});

export const ForgotPasswordDTO = t.Object({
  identifier: t.String({
    minLength: 3,
    description: "NIP atau email user",
  }),
});

export const SendCodeDTO = t.Object({
  identifier: t.String({
    minLength: 3,
    description: "NIP atau email user",
  }),
});

export const ResetPasswordDTO = t.Object({
  token: t.String({ minLength: 20 }),
  code: t.String({ minLength: 6, maxLength: 6 }),
  newPassword: t.String({ minLength: 8 }),
  confirmPassword: t.String({ minLength: 8 }),
});

export const VerifyCodeDTO = t.Object({
  token: t.String({ minLength: 20 }),
  code: t.String({ minLength: 6, maxLength: 6 }),
});

// export type... ini untuk memudahkan kita dalam menggunakan tipe data dari DTO di service atau controller, jadi kita tidak perlu menulis ulang tipe data secara manual.
export type LoginPayload = typeof LoginDTO.static;
export type ForgotPasswordPayload = typeof ForgotPasswordDTO.static;
export type SendCodePayload = typeof SendCodeDTO.static;
export type ResetPasswordPayload = typeof ResetPasswordDTO.static;
export type VerifyCodePayload = typeof VerifyCodeDTO.static;
