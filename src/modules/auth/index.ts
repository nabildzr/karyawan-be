import cookie from "@elysiajs/cookie";
import jwt from "@elysiajs/jwt";
import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { errorResponse, successResponse } from "../../utils";
import { LoginDTO } from "./model";
import { AuthService } from "./service";

export const authRoutes = new Elysia({
  prefix: "/auth",
  detail: { tags: ["Authentication"] },
})
  // instalasi plugin jwt & cookie
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "owo-dan-owi",
    }),
  )
  .use(cookie())
  .post(
    "/login",
    async ({ body, set, jwt, cookie: { auth_session } }) => {
      try {
        // sevrice
        const verifiedUser = await AuthService.authenticateUser(body);

        // gen jwt payload
        const token = await jwt.sign({
          sub: verifiedUser.id,
          role: verifiedUser.role,
          exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 hari
        });

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
    },
  )

  .get(
    "/me",
    async ({ jwt, cookie: { auth_session }, query, set }) => {
      try {
        const auth = await jwt.verify(auth_session.value as string);
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
      query: t.Object({
        withEmployee: t.Optional(t.Boolean()),
      }),
    },
  )
  .post("/logout", ({ cookie: { auth_session }, set }) => {
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
  });
