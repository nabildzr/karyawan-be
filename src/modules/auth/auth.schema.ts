import { t } from "elysia";

/** Mengekspor AuthLoginBodyDTO untuk kebutuhan modul ini. */
export const AuthLoginBodyDTO = t.Object({
  nip: t.String(),
  password: t.String(),
  clientType: t.Union([t.Literal("WEB"), t.Literal("MOBILE")], {
    description: "Type of client logging in (web or mobile)",
  }),
});

/** Mengekspor AuthIdentifierBodyDTO untuk kebutuhan modul ini. */
export const AuthIdentifierBodyDTO = t.Object({
  identifier: t.String({
    minLength: 3,
    description: "NIP atau email user",
  }),
});

/** Mengekspor AuthResetPasswordBodyDTO untuk kebutuhan modul ini. */
export const AuthResetPasswordBodyDTO = t.Object({
  token: t.String({ minLength: 20 }),
  code: t.String({ minLength: 6, maxLength: 6 }),
  newPassword: t.String({ minLength: 8 }),
  confirmPassword: t.String({ minLength: 8 }),
});

/** Mengekspor AuthVerifyCodeBodyDTO untuk kebutuhan modul ini. */
export const AuthVerifyCodeBodyDTO = t.Object({
  token: t.String({ minLength: 20 }),
  code: t.String({ minLength: 6, maxLength: 6 }),
});

/** Mengekspor AuthMeQueryDTO untuk kebutuhan modul ini. */
export const AuthMeQueryDTO = t.Object({
  withEmployee: t.Optional(t.Boolean()),
});

/** Mendefinisikan alias tipe untuk AuthLoginBodyPayload. */
export type AuthLoginBodyPayload = typeof AuthLoginBodyDTO.static;

/** Mendefinisikan alias tipe untuk AuthIdentifierBodyPayload. */
export type AuthIdentifierBodyPayload = typeof AuthIdentifierBodyDTO.static;

/** Mendefinisikan alias tipe untuk AuthResetPasswordBodyPayload. */
export type AuthResetPasswordBodyPayload =
  typeof AuthResetPasswordBodyDTO.static;

/** Mendefinisikan alias tipe untuk AuthVerifyCodeBodyPayload. */
export type AuthVerifyCodeBodyPayload = typeof AuthVerifyCodeBodyDTO.static;

/** Mendefinisikan alias tipe untuk AuthMeQueryPayload. */
export type AuthMeQueryPayload = typeof AuthMeQueryDTO.static;
