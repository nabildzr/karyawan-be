import { Elysia } from "elysia";
import { PrismaClient } from "./generated/prisma/client";
import { server_v1 } from "./server";
import { cors } from "@elysiajs/cors";

const PORT = Bun.env.PORT || 3000;

const app = new Elysia()
  .use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      credentials: true,
    }),
  )
  // API Routes
  .use(server_v1)

  // Start server
  .listen(PORT);
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
