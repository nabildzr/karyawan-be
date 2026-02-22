import cookie from "@elysiajs/cookie";
import jwt from "@elysiajs/jwt";
import Elysia, { t } from "elysia";
import { AuthService } from "./service";
import { LoginDTO } from "./model";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { apiResponse, errorResponse, successResponse } from "../../utils";

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
        auth_session.set({
          value: token,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 7 * 24 * 60 * 60, // 7 hari
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({ data: { token }, message: "Login berhasil" });
      } catch (error) {
        console.error("Login error:", error);
        set.status = 401;
        return errorResponse("Login gagal");
      }
    },
    {
      body: LoginDTO,
    },
  );
