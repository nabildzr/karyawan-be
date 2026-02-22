import { createHmac } from "crypto";

// & ============ JWT Payload Interface ============
export interface JWTPayload {
  sub: string; // userId
  nip: string;
  role: "ADMIN" | "USER";
  employeeId: string | null;
  iat: number;
  exp: number;
}

// & ============ Helpers ============
function base64urlEncode(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function base64urlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf-8");
}

// & ============ Sign JWT ============
/**
 * Create a signed JWT token using HMAC-SHA256.
 * @param payload - Data to encode (sub, nip, role, employeeId)
 * @param secret  - HMAC secret key
 * @param expiresInDays - Token validity in days (default: 7)
 */
export function signJWT(
  payload: Omit<JWTPayload, "iat" | "exp">,
  secret: string,
  expiresInDays: number = 7,
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInDays * 86400,
  };

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(fullPayload));
  const data = `${headerB64}.${payloadB64}`;

  const signature = createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  return `${data}.${signature}`;
}

// & ============ Verify JWT ============
/**
 * Verify and decode a JWT token.
 * Throws on invalid signature or expired token.
 */
export function verifyJWT(token: string, secret: string): JWTPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Format token tidak valid");
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const data = `${headerB64}.${payloadB64}`;

  const expectedSignature = createHmac("sha256", secret)
    .update(data)
    .digest("base64url");

  if (signatureB64 !== expectedSignature) {
    throw new Error("Signature token tidak valid");
  }

  const payload = JSON.parse(base64urlDecode(payloadB64)) as JWTPayload;

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token sudah kadaluarsa");
  }

  return payload;
}
