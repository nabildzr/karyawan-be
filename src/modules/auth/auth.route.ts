import { cookie } from "@elysiajs/cookie";
import { jwt } from "@elysiajs/jwt";
import Elysia from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { constants } from "../../config/constants";
import { authPlugin, checkAuth, signJWT } from "../../middleware/auth";
import { mapError } from "../../utils/mapError";
import { successResponse } from "../../utils/response_helper";
import {
    AuthIdentifierBodyDTO,
    AuthLoginBodyDTO,
    AuthMeQueryDTO,
    AuthResetPasswordBodyDTO,
    AuthVerifyCodeBodyDTO,
} from "./auth.schema";
import { AuthService } from "./auth.service";

/** Mengekspor authRoutes untuk kebutuhan modul ini. */
export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(
    jwt({
      secret: constants.auth.jwtSecret,
      name: "jwt",
    }),
  )
  .use(cookie())
  .post(
    "/login",
    async ({ body, set, cookie }) => {
      try {
        const verifiedUser = await AuthService.authenticateUser(body);

        const token = await signJWT(
          {
            sub: verifiedUser.id,
            role: verifiedUser.role,
            rbacRoleKey: verifiedUser.rbacRoleKey,
            employeeId: verifiedUser.employeeId,
            email: verifiedUser.email,
          },
          constants.auth.jwtSecret,
        );

        set.status = HttpStatusEnum.HTTP_200_OK;

        if (body.clientType === "WEB") {
          cookie.authToken.set({
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 7 * 24 * 60 * 60,
          });

          return successResponse({
            data: {
              user: verifiedUser,
            },
            message: "Login berhasil (web, via cookie)",
          });
        }

        return successResponse({
          data: {
            token,
            user: verifiedUser,
          },
          message: "Login berhasil",
        });
      } catch (error) {
        return mapError(error, set);
      }
    },
    {
      body: AuthLoginBodyDTO,
    },
  )
  .post(
    "/send-code",
    async ({ body, set }) => {
      try {
        const response = await AuthService.sendCode(body);

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: response,
          message: "Jika akun ditemukan, kode reset berhasil dikirim.",
        });
      } catch (error) {
        return mapError(error, set);
      }
    },
    {
      body: AuthIdentifierBodyDTO,
    },
  )
  .post(
    "/forgot-password",
    async ({ body, set }) => {
      try {
        const response = await AuthService.forgotPassword(body);

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: response,
          message: "Jika akun ditemukan, kode reset berhasil dikirim.",
        });
      } catch (error) {
        return mapError(error, set);
      }
    },
    {
      body: AuthIdentifierBodyDTO,
    },
  )
  .post(
    "/reset-password",
    async ({ body, set }) => {
      try {
        await AuthService.resetPassword(body);

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: {
            updated: true,
          },
          message: "Password berhasil diperbarui.",
        });
      } catch (error) {
        return mapError(error, set);
      }
    },
    {
      body: AuthResetPasswordBodyDTO,
    },
  )
  .post(
    "/verify-code",
    async ({ body, set }) => {
      try {
        const response = await AuthService.verifyCode(body);

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: response,
          message: "Kode verifikasi valid.",
        });
      } catch (error) {
        return mapError(error, set);
      }
    },
    {
      body: AuthVerifyCodeBodyDTO,
    },
  )
  .use(authPlugin)
  .get(
    "/me",
    async ({ auth, query, set }) => {
      try {
        const profile = await AuthService.me(auth!.sub, {
          withEmployee: Boolean(query.withEmployee),
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: profile,
          message: "Data user berhasil diambil",
        });
      } catch (error) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: checkAuth,
      query: AuthMeQueryDTO,
    },
  )
  .post("/logout", async ({ cookie, set }) => {
    cookie.authToken?.remove();

    set.status = HttpStatusEnum.HTTP_200_OK;
    return successResponse({
      message: "Logout berhasil (cookie dihapus)",
    });
  });
