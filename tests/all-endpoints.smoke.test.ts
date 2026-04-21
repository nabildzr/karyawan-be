import { beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { server_v1 } from "../src/server";

/**
 * Smoke test untuk memastikan semua endpoint yang terdokumentasi di OpenAPI spec dapat di-handle oleh server tanpa menghasilkan 404/405.
 * Test ini tidak memeriksa validitas response, melainkan hanya memastikan route handler terpasang dengan benar untuk setiap endpoint.
 * Jika ada endpoint yang menghasilkan 404/405, berarti ada kemungkinan route handler tidak terpasang atau path/method tidak sesuai dengan dokumentasi SWAGGER.
 */

type OpenApiOperation = {
  requestBody?: {
    content?: Record<string, unknown>;
  };
};

type OpenApiSpec = {
  paths?: Record<string, Record<string, OpenApiOperation>>;
};

const BASE_URL = "http://localhost";
const METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);
const app = new Elysia().use(server_v1);

const withVersionPrefix = (specPath: string) => {
  const normalized = specPath.startsWith("/") ? specPath : `/${specPath}`;
  return normalized.startsWith("/v1") ? normalized : `/v1${normalized}`;
};

const buildPathValue = (paramName: string) => {
  const lowered = paramName.toLowerCase();

  if (lowered.includes("id")) return "test-id";
  if (lowered.includes("date")) return "2026-01-01";
  if (lowered.includes("year")) return "2026";
  if (lowered.includes("month")) return "1";

  return "sample";
};

const toRequestPath = (pathTemplate: string) =>
  pathTemplate.replace(/\{([^}]+)\}/g, (_, paramName: string) => buildPathValue(paramName));

const bodyTypeFromOperation = (operation: OpenApiOperation) => {
  const content = operation.requestBody?.content ?? {};

  if ("multipart/form-data" in content) return "multipart/form-data";
  if ("application/x-www-form-urlencoded" in content)
    return "application/x-www-form-urlencoded";
  if ("application/json" in content) return "application/json";

  return null;
};

const buildRequestInit = (method: string, operation: OpenApiOperation): RequestInit => {
  const headers = new Headers();
  headers.set("accept", "application/json");

  const upperMethod = method.toUpperCase();
  const init: RequestInit = {
    method: upperMethod,
    headers,
  };

  if (["POST", "PUT", "PATCH", "DELETE"].includes(upperMethod)) {
    const bodyType = bodyTypeFromOperation(operation);

    if (bodyType === "application/json") {
      headers.set("content-type", "application/json");
      init.body = JSON.stringify({});
    } else if (bodyType === "application/x-www-form-urlencoded") {
      headers.set("content-type", "application/x-www-form-urlencoded");
      init.body = new URLSearchParams();
    } else if (bodyType === "multipart/form-data") {
      // Let runtime set multipart boundary automatically.
      init.body = new FormData();
    }
  }

  return init;
};

const isRouteLevelNotFound = (status: number, bodyText: string) => {
  if (status !== 404) return false;

  const normalized = bodyText.trim().toUpperCase();

  // Elysia default unmatched-route response is plain "NOT_FOUND".
  return normalized === "NOT_FOUND";
};

describe("API endpoint smoke tests (Elysia app.handle)", () => {
  let spec: OpenApiSpec;

  beforeAll(async () => {
    const response = await app.handle(new Request(`${BASE_URL}/v1/swagger/json`));

    expect(response.status).toBe(200);
    spec = (await response.json()) as OpenApiSpec;
    expect(spec.paths).toBeDefined();
    expect(Object.keys(spec.paths ?? {}).length).toBeGreaterThan(0);
  });

  it("should resolve every documented endpoint (no route-level 404/405)", async () => {
    const failures: string[] = [];

    for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
      for (const [method, operation] of Object.entries(pathItem)) {
        const loweredMethod = method.toLowerCase();
        if (!METHODS.has(loweredMethod)) continue;

        const urlPath = withVersionPrefix(toRequestPath(path));
        const request = new Request(
          `${BASE_URL}${urlPath}`,
          buildRequestInit(loweredMethod, operation),
        );

        const response = await app.handle(request);
        const bodyText = await response.text();

        // Route is considered valid even when business logic returns 404 for missing entities.
        if (response.status === 405 || isRouteLevelNotFound(response.status, bodyText)) {
          failures.push(
            `${loweredMethod.toUpperCase()} ${urlPath} => ${response.status} ${bodyText}`,
          );
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
