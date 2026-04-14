import { t } from "elysia";


export const LoginDTO = t.Object({
  nip: t.String(),
  password: t.String(),
  clientType: t.Union([t.Literal("WEB"), t.Literal("MOBILE")], {
    description: "Type of client logging in (web or mobile)",
  }),
})


// export type... ini untuk memudahkan kita dalam menggunakan tipe data dari DTO di service atau controller, jadi kita tidak perlu menulis ulang tipe data secara manual, cukup gunakan LoginPayload yang sudah didefinisikan ini
export type LoginPayload = typeof LoginDTO.static;