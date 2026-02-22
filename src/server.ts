import swagger from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { authPlugin } from "./middleware/auth";
import { RootHandler } from "./modules/root";
import { authRoutes } from "./modules/auth";
import { constants } from "./config/constants";
import { employeeRoutes } from "./modules/employees";


// ROUTES
export const server_v1 = new Elysia({
  prefix: `/v${constants.api.version}`,
});

// Register routes
server_v1
  // & Auth Plugin — derive { auth } context dari Bearer token untuk semua route
  .use(authPlugin)

  // & PUBLIC ROUTES — tidak perlu token
  .use(RootHandler)
  .use(authRoutes)

  // & PROTECTED ROUTES — setiap route menentukan level akses sendiri via beforeHandle
  .use(employeeRoutes)
 
  // Swagger Documentation
  .use(
    swagger({
      autoDarkMode: true,
      documentation: {
        info: {
          title: constants.server.name,
          version: constants.server.version,
          description: `API Documentation for ${constants.server.name}`,
          contact: {
            name: constants.server.author,
            email: constants.server.email,
          },
        },
      },
      swaggerOptions: {
        syntaxHighlight: { theme: "monokai" },
      },
    }),
  );

console.debug("Loading V1 Server... Done!");
