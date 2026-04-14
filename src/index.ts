import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { attendanceCronPlugin } from "./app/jobs/attendanceCron";
import { holidayRoutes } from "./modules/holidays";
import { server_v1 } from "./server";

const PORT = Bun.env.PORT || 3000;

const app = new Elysia()
  .use(
    cors({
      origin: (request) => {
        const origin = request.headers.get("origin");
        const allowed = ["http://localhost:5173", "https://app.attendace.com"];
        return allowed.includes(origin ?? "") ? true : false;
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  )
  // API Routes
  .use(server_v1)
  .use(attendanceCronPlugin)

  // Start server
  .listen(PORT);
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
