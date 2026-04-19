// * Backend module: karyawan-be/src/index.ts
// & This file defines backend logic for index.ts.
// % File ini mendefinisikan logika backend untuk index.ts.

import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { attendanceCronPlugin } from "./app/jobs/attendanceCron";
import { pointsCronPlugin } from "./app/jobs/pointsJobs";
import { server_v1 } from "./server";
import { redisPlugin } from "./config/redis";

const PORT = Bun.env.PORT || 3000;

const app = new Elysia()
  .use(
    cors({
      origin: (request) => {
        const origin = request.headers.get("origin");
        const allowed = ["http://localhost:5173", "http://localhost:3000", "*"];
        return allowed.includes(origin ?? "") ? true : false;
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  )
  // API Routes
  .use(redisPlugin)
  .use(server_v1)
  .use(attendanceCronPlugin)
  .use(pointsCronPlugin)

  // Start server
  .listen(PORT);
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
