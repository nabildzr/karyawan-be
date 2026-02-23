import { Elysia, t } from "elysia";
import { authPlugin, checkAuth } from "../../middleware/auth";
import { AttendanceService } from "./services";

export const attendanceRoutes = new Elysia({ prefix: "/attendances" })
  .use(authPlugin)
  .post("/check-in", async ({ auth, body, set }) => {
    try {
      // ! pakai dummy dulu, debug pake desktop cam
      const result = await AttendanceService.verifyFaceCheckIn("efadbc4d-8cf9-4a1b-aa20-448508ea0430", body.image);
      
      set.status = 200;
      return result; // ? Lolos absen!
    } catch (error: any) {
      console.error("Check-In Error:", error);
      
      if (error.message.startsWith("Unauthorized")) set.status = 401; // ? muka ga cocok
      else if (error.message.startsWith("Forbidden")) set.status = 403; // ? belum registrasi
      else if (error.message.startsWith("Flask AI Error")) set.status = 400; // ? muka ga ketemu/kegelapan
      else set.status = 500;

      return {
        success: false,
        message: error.message.split(": ")[1] || "Gagal melakukan absensi.",
      };
    }
  }, {
    // beforeHandle: [checkAuth],
    body: t.Object({
      image: t.File({ type: ['image/jpeg', 'image/png'] })
    })
  });