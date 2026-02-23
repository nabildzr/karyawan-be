import { Elysia, t } from "elysia";
import { authPlugin, checkAuth } from "../../middleware/auth";
import { FaceService } from "./services";

export const faceRoutes = new Elysia({ prefix: "/faces" })
  // ?! Wajibkan login (Soft Auth -> Guard checkAuth)
  .use(authPlugin)
  
  .post("/register", async ({ auth, body, set }) => {
    try {
      // ? ekstrak file gambar dari request Flutter
      const imageFile = body.image;

      // ? panggil Service dengan userId dari token JWT
      await FaceService.registerFace("efadbc4d-8cf9-4a1b-aa20-448508ea0430", imageFile);

      set.status = 201;
      return {
        success: true,
        message: "Registrasi biometrik berhasil. Wajah Anda telah diamankan.",
      };
    } catch (error: any) {
      console.error("Face Registration Error:", error);
      
      if (error.message.startsWith("Conflict")) set.status = 409;
      else if (error.message.startsWith(" Not Found")) set.status = 404;
      else if (error.message.includes("Flask AI Error")) set.status = 400;
      else set.status = 500;

      return {
        success: false,
        message: error.message.split(": ")[1] || "Gagal melakukan registrasi wajah.",
      };
    }
  }, {
    // ? Elysia Guard: wajibin user bawa token JWT
    // beforeHandle: [checkAuth],
    
    // ? Elysia Schema Validator: wajib ngirim file gambar (multipart)
    body: t.Object({
      image: t.File({
        type: ['image/jpeg', 'image/png'], // ? cmn terima JPG/PNG
        maxSize: 5 * 1024 * 1024 // ? maksimal ukuran file 5MB biar Flask ga ngos-ngosan
      })
    })
  });