// * Backend module: karyawan-be/src/modules/auth/index.ts
// & This file defines backend logic for index.ts.
// % File ini mendefinisikan logika backend untuk index.ts.

import cookie from "@elysiajs/cookie";
import jwt from "@elysiajs/jwt";
import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { constants } from "../../config/constants";
import { authPlugin, checkAuth, signJWT } from "../../middleware/auth";
import { errorResponse, successResponse } from "../../utils";
import {
  ForgotPasswordDTO,
  LoginDTO,
  ResetPasswordDTO,
  SendCodeDTO,
  VerifyCodeDTO,
} from "./model";
import { AuthService } from "./service";

export const authRoutes = new Elysia({
  prefix: "/auth",
  detail: { tags: ["Authentication"] },
})
  // instalasi plugin jwt & cookie
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "kepo",
    }),
  )
  .use(cookie())
  .post(
    "/login",
    async ({ body, set, cookie: { auth_session } }) => {
      try {
        // sevrice
        const verifiedUser = await AuthService.authenticateUser(body);

        const token = await signJWT(
          {
            sub: verifiedUser.id,
            employeeId: verifiedUser.employeeId,
            email: verifiedUser.email,
            role: verifiedUser.role ?? verifiedUser.rbacRoleKey,
            rbacRoleKey: verifiedUser.rbacRoleKey,
          },
          constants.auth.jwtSecret,
        );

        // set http only cookie
        set.status = HttpStatusEnum.HTTP_200_OK;

        if (body.clientType === "WEB") {
          // ? skenario web: ngirim nya via cookie yg aman (http only), biar ga kena XSS Attack
          auth_session.set({
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 7 * 24 * 60 * 60, // 7 hari
          });

          return successResponse({
            message: "Login berhasil",
            // ? token ga di return disini krna demi keamanan XSS di web
          });
        } else {
          // ? skenario mobile (flutter): jdi ngirim token di resp body, karna ga bisa set cookie http only. tapi tetep pake jwt plugin buat generate token, biar konsisten secret & method signing nya

          return successResponse({
            data: { accessToken: token },
            message: "Login berhasil",
          });
        }
      } catch (error: any) {
        console.error("Login error:", error);

        if (error.message.startsWith("Bad Request"))
          set.status = HttpStatusEnum.HTTP_400_BAD_REQUEST;
        else if (error.message.startsWith("Not Found"))
          set.status = HttpStatusEnum.HTTP_404_NOT_FOUND;
        else if (error.message.startsWith("Forbidden"))
          set.status = HttpStatusEnum.HTTP_403_FORBIDDEN;
        else set.status = HttpStatusEnum.HTTP_500_INTERNAL_SERVER_ERROR;

        return errorResponse(
          error.message.split(": ")[1] || "Terjadi kesalahan saat login.",
        );
      }
    },
    {
      body: LoginDTO,
      detail: { summary: "Login user dan dapatkan token akses" },
    },
  )
  .post(
    "/send-code",
    async ({ body, set }) => {
      try {
        const result = await AuthService.sendCode(body);

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: result,
          message:
            "Jika akun ditemukan, kode dan link reset password akan dikirim ke email terdaftar.",
        });
      } catch (error: any) {
        console.error("Send code error:", error);

        if (error.message.startsWith("Bad Request")) {
          set.status = HttpStatusEnum.HTTP_400_BAD_REQUEST;
        } else {
          set.status = HttpStatusEnum.HTTP_500_INTERNAL_SERVER_ERROR;
        }

        return errorResponse(
          error.message.split(": ")[1] ||
            "Terjadi kesalahan saat mengirim kode verifikasi.",
        );
      }
    },
    {
      body: SendCodeDTO,
      detail: {
        summary:
          "Kirim kode verifikasi reset password berdasarkan NIP atau email",
      },
    },
  )
  .post(
    "/forgot-password",
    async ({ body, set }) => {
      try {
        const result = await AuthService.forgotPassword(body);

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: result,
          message:
            "Jika akun ditemukan, kode dan link reset password akan dikirim ke email terdaftar.",
        });
      } catch (error: any) {
        console.error("Forgot password error:", error);

        if (error.message.startsWith("Bad Request")) {
          set.status = HttpStatusEnum.HTTP_400_BAD_REQUEST;
        } else {
          set.status = HttpStatusEnum.HTTP_500_INTERNAL_SERVER_ERROR;
        }

        return errorResponse(
          error.message.split(": ")[1] ||
            "Terjadi kesalahan saat memproses lupa password.",
        );
      }
    },
    {
      body: ForgotPasswordDTO,
      detail: {
        summary: "Legacy alias untuk kirim kode verifikasi reset password",
      },
    },
  )
  .post(
    "/reset-password",
    async ({ body, set }) => {
      try {
        await AuthService.resetPassword(body);

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          message:
            "Password berhasil direset. Silakan login menggunakan password baru.",
        });
      } catch (error: any) {
        console.error("Reset password error:", error);

        if (error.message.startsWith("Bad Request")) {
          set.status = HttpStatusEnum.HTTP_400_BAD_REQUEST;
        } else {
          set.status = HttpStatusEnum.HTTP_500_INTERNAL_SERVER_ERROR;
        }

        return errorResponse(
          error.message.split(": ")[1] ||
            "Terjadi kesalahan saat reset password.",
        );
      }
    },
    {
      body: ResetPasswordDTO,
      detail: {
        summary: "Reset password menggunakan token reset",
      },
    },
  )

  .post(
    "/verify-code",
    async ({ body, set }) => {
      try {
        const result = await AuthService.verifyCode(body);

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: result,
          message: "Kode verifikasi valid.",
        });
      } catch (error: any) {
        console.error("Verify code error:", error);

        if (error.message.startsWith("Bad Request")) {
          set.status = HttpStatusEnum.HTTP_400_BAD_REQUEST;
        } else {
          set.status = HttpStatusEnum.HTTP_500_INTERNAL_SERVER_ERROR;
        }

        return errorResponse(
          error.message.split(": ")[1] ||
            "Terjadi kesalahan saat verifikasi kode.",
        );
      }
    },
    {
      body: VerifyCodeDTO,
      detail: {
        summary: "Verifikasi kode reset password",
      },
    },
  )
  .use(authPlugin)
  .get(
    "/me",
    async ({ auth, cookie: { auth_session }, query, set }) => {
      try {
        if (!auth || !auth.sub) {
          set.status = HttpStatusEnum.HTTP_401_UNAUTHORIZED;
          return errorResponse("Token tidak valid atau tidak ditemukan.");
        }
        const { withEmployee } = query;
        const userData = await AuthService.me(auth.sub, {
          withEmployee: Boolean(withEmployee),
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: userData,
          message: "Data user berhasil diambil",
        });
      } catch (error: any) {
        console.error("Get current user error:", error);
        if (error.message.startsWith("Not Found"))
          set.status = HttpStatusEnum.HTTP_404_NOT_FOUND;
        else set.status = HttpStatusEnum.HTTP_500_INTERNAL_SERVER_ERROR;
        return errorResponse(
          error.message.split(": ")[1] ||
            "Terjadi kesalahan saat mengambil data user.",
        );
      }
    },
    {
      beforeHandle: [checkAuth],
      query: t.Object({
        withEmployee: t.Optional(t.Boolean()),
      }),
      detail: { summary: "Ambil data user saat ini" },
    },
  )
  .post(
    "/logout",
    ({ cookie: { auth_session }, set }) => {
      // ? collect cookie's object  & set empty value + expired (invalidation, timpa)
      auth_session.set({
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0, // langsung expired
      });
      set.status = HttpStatusEnum.HTTP_200_OK;
      return successResponse({
        message: "Sesi berhasil diakhiri. Anda telah logout.",
      });
    },
    {
      // beforeHandle: [checkAuth],
      detail: { summary: "Logout user dengan menghapus cookie sesi" },
    },
  );
