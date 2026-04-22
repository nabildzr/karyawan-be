import { hash, verify } from "argon2";
import { createHash, randomUUID, timingSafeEqual } from "crypto";
import * as jose from "jose";
import nodemailer from "nodemailer";
import { constants } from "../../config/constants";
import {
  findLoginUserByNip,
  findResetUserByIdentifier,
  findUserPasswordSnapshotById,
  findUserProfileById,
  findWebPortalPermissionByRoleId,
  updateUserPasswordById,
} from "./auth.repository";
import type {
  AuthIdentifierBodyPayload,
  AuthLoginBodyPayload,
  AuthMeQueryPayload,
  AuthResetPasswordBodyPayload,
  AuthVerifyCodeBodyPayload,
} from "./auth.schema";

const RESET_PASSWORD_TOKEN_PURPOSE = "RESET_PASSWORD";
const RESET_PASSWORD_EXPIRY_MINUTES = 15;
const RESET_CODE_LENGTH = 6;

type ResetTokenPayload = {
  userId: string;
  passwordUpdatedAtEpochMs: number;
  codeHash: string;
};

type ResetCodeResponse = {
  expiresInMinutes: number;
  resetToken?: string;
  resetUrl?: string;
  verificationCode?: string;
  mailDispatched?: boolean;
};

type SmtpMailConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS?: boolean;
  fromEmail: string;
  fromName: string;
  auth?: {
    user: string;
    pass: string;
  };
};

type SendResetPasswordEmailParams = {
  toEmail: string;
  recipientName?: string | null;
  verificationCode: string;
  resetUrl: string;
  expiresInMinutes: number;
};

let smtpTransporter: nodemailer.Transporter | null = null;
let smtpTransporterCacheKey = "";

/** Menormalisasi value boolean dari environment variable. */
function parseBooleanEnv(value?: string) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

/** Membersihkan kutip opsional pada value string env. */
function stripOptionalQuotes(value: string) {
  return value.replace(/^['\"]|['\"]$/g, "");
}

/** Menormalisasi host SMTP dari value env yang beragam formatnya. */
function normalizeSmtpHost(value?: string) {
  const raw = stripOptionalQuotes(String(value ?? "").trim());
  if (!raw) return "";

  return raw
    .replace(/^smtps?:\/\//i, "")
    .replace(/\/.*$/, "")
    .split(/\s+/)[0]
    .trim();
}

/** Menentukan error SMTP yang aman untuk dilakukan retry. */
function shouldRetrySmtpError(error: unknown) {
  const code = String((error as any)?.code ?? "").toUpperCase();
  return (
    code === "ENOTFOUND" ||
    code === "EDNS" ||
    code === "EAI_AGAIN" ||
    code === "ETIMEDOUT"
  );
}

/** Mengirim email dengan retry terbatas untuk kegagalan DNS/jaringan sementara. */
async function sendMailWithRetry(
  transporter: nodemailer.Transporter,
  mailOptions: nodemailer.SendMailOptions,
  maxRetry = 1,
) {
  let attempt = 0;

  while (attempt <= maxRetry) {
    try {
      await transporter.sendMail(mailOptions);
      return;
    } catch (error) {
      if (attempt >= maxRetry || !shouldRetrySmtpError(error)) {
        throw error;
      }

      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

/** Mengambil konfigurasi SMTP dari environment variables. */
function getSmtpMailConfig(): SmtpMailConfig | null {
  const host = normalizeSmtpHost(process.env.SMTP_HOST);
  const portRaw = stripOptionalQuotes(
    String(process.env.SMTP_PORT ?? "").trim(),
  );
  const port = Number(portRaw || "587");
  const user = stripOptionalQuotes(String(process.env.SMTP_USER ?? "").trim());
  const rawPass = stripOptionalQuotes(
    String(process.env.SMTP_PASS ?? "").trim(),
  );
  const pass = /gmail\.com$/i.test(host)
    ? rawPass.replace(/\s+/g, "")
    : rawPass;
  const fromEmail = stripOptionalQuotes(
    String(
      process.env.SMTP_FROM_EMAIL || user || constants.server.email,
    ).trim(),
  );
  const fromName = stripOptionalQuotes(
    String(process.env.SMTP_FROM_NAME || constants.server.name).trim(),
  );

  if (!host || !Number.isFinite(port) || !fromEmail) {
    return null;
  }

  const secureRaw = stripOptionalQuotes(
    String(process.env.SMTP_SECURE ?? "")
      .trim()
      .toLowerCase(),
  );
  const secure =
    parseBooleanEnv(secureRaw) ||
    secureRaw === "ssl" ||
    secureRaw === "smtps" ||
    port === 465;
  const requireTLS =
    secureRaw === "tls" ||
    secureRaw === "starttls" ||
    (!secure && port === 587);
  const auth = user && pass ? { user, pass } : undefined;

  return {
    host,
    port,
    secure,
    requireTLS,
    fromEmail,
    fromName,
    auth,
  };
}

/** Mengambil instance SMTP transporter yang dicache berdasarkan konfigurasi aktif. */
function getSmtpTransporter(config: SmtpMailConfig) {
  const transporterCacheKey = [
    config.host,
    String(config.port),
    String(config.secure),
    config.auth?.user ?? "",
  ].join("|");

  if (!smtpTransporter || smtpTransporterCacheKey !== transporterCacheKey) {
    smtpTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTLS,
      auth: config.auth,
    });
    smtpTransporterCacheKey = transporterCacheKey;
  }

  return smtpTransporter;
}

/** Mengirim email reset password dengan fallback aman jika SMTP belum dikonfigurasi. */
async function sendResetPasswordEmail(
  params: SendResetPasswordEmailParams,
): Promise<boolean> {
  const smtpConfig = getSmtpMailConfig();
  if (!smtpConfig) {
    console.warn(
      "[auth] SMTP belum dikonfigurasi. Lewati pengiriman email reset password.",
    );
    return false;
  }

  const recipientName = params.recipientName?.trim() || "Karyawan";
  const subject = "Kode Reset Password Portal Karyawan";
  const text = [
    `Halo ${recipientName},`,
    "",
    "Kami menerima permintaan reset password untuk akun Anda.",
    `Kode verifikasi: ${params.verificationCode}`,
    `Link reset password: ${params.resetUrl}`,
    `Kode berlaku selama ${params.expiresInMinutes} menit.`,
    "",
    "Abaikan email ini jika Anda tidak meminta reset password.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <p>Halo <strong>${recipientName}</strong>,</p>
      <p>Kami menerima permintaan reset password untuk akun Anda.</p>
      <p>
        Kode verifikasi:<br />
        <span style="font-size: 28px; letter-spacing: 4px; font-weight: 700;">${params.verificationCode}</span>
      </p>
      <p>
        Link reset password:<br />
        <a href="${params.resetUrl}">${params.resetUrl}</a>
      </p>
      <p>Kode berlaku selama <strong>${params.expiresInMinutes} menit</strong>.</p>
      <p>Abaikan email ini jika Anda tidak meminta reset password.</p>
    </div>
  `;

  try {
    const transporter = getSmtpTransporter(smtpConfig);
    await sendMailWithRetry(transporter, {
      from: `${smtpConfig.fromName} <${smtpConfig.fromEmail}>`,
      to: params.toEmail,
      subject,
      text,
      html,
    });
    return true;
  } catch (error: any) {
    console.error("[auth] Gagal mengirim email reset password:", {
      code: String(error?.code ?? "UNKNOWN"),
      command: error?.command,
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      requireTLS: smtpConfig.requireTLS,
      message: String(error?.message ?? error),
    });
    return false;
  }
}

/** Menghasilkan kode verifikasi 6 digit untuk alur reset password. */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Melakukan hashing kode verifikasi sebelum disematkan dalam token reset. */
function hashVerificationCode(code: string) {
  return createHash("sha256")
    .update(`${code}:${constants.auth.jwtSecret}`)
    .digest("hex");
}

/** Memvalidasi format kode verifikasi reset password. */
function isValidCodeFormat(code: string) {
  return /^\d{6}$/.test(code);
}

/** Membandingkan hash kode expected vs hash kode input secara timing-safe. */
function isCodeHashMatch(expectedHash: string, code: string) {
  const actualHash = hashVerificationCode(code);
  const expectedBuffer = Buffer.from(expectedHash);
  const actualBuffer = Buffer.from(actualHash);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

/** Menandatangani JWT reset password satu kali pakai. */
async function signResetPasswordToken(payload: ResetTokenPayload) {
  const secretKey = new TextEncoder().encode(constants.auth.jwtSecret);

  return new jose.SignJWT({
    purpose: RESET_PASSWORD_TOKEN_PURPOSE,
    passwordUpdatedAtEpochMs: payload.passwordUpdatedAtEpochMs,
    codeHash: payload.codeHash,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${RESET_PASSWORD_EXPIRY_MINUTES}m`)
    .sign(secretKey);
}

/** Memverifikasi dan mengekstrak payload token reset password. */
async function verifyResetPasswordToken(
  token: string,
): Promise<ResetTokenPayload> {
  const secretKey = new TextEncoder().encode(constants.auth.jwtSecret);
  const { payload } = await jose.jwtVerify(token, secretKey);

  const purpose = String(payload.purpose ?? "");
  const userId = String(payload.sub ?? "");
  const passwordUpdatedAtEpochMs = Number(
    payload.passwordUpdatedAtEpochMs ?? 0,
  );
  const codeHash = String(payload.codeHash ?? "");

  if (
    purpose !== RESET_PASSWORD_TOKEN_PURPOSE ||
    !userId ||
    !passwordUpdatedAtEpochMs ||
    !codeHash
  ) {
    throw new Error("Bad Request: Token reset password tidak valid.");
  }

  return {
    userId,
    passwordUpdatedAtEpochMs,
    codeHash,
  };
}

/** Mengirim kode reset password berdasarkan identifier NIP/email. */
async function sendResetCodeByIdentifier(
  identifierRaw: string,
): Promise<ResetCodeResponse> {
  const identifier = identifierRaw.trim();

  if (!identifier) {
    throw new Error("Bad Request: Identifier wajib diisi.");
  }

  const user = await findResetUserByIdentifier(identifier);

  const userId = user?.id ?? randomUUID();
  const passwordUpdatedAtEpochMs = user?.updatedAt.getTime() ?? Date.now();
  const verificationCode = generateVerificationCode();
  const resetToken = await signResetPasswordToken({
    userId,
    passwordUpdatedAtEpochMs,
    codeHash: hashVerificationCode(verificationCode),
  });

  const resetPath = `/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
  const webBaseUrl =
    process.env.WEB_BASE_URL ||
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL;
  const baseUrl = String(webBaseUrl ?? "")
    .trim()
    .replace(/\/+$/, "");
  const resetUrl = baseUrl ? `${baseUrl}${resetPath}` : resetPath;

  const response: ResetCodeResponse = {
    expiresInMinutes: RESET_PASSWORD_EXPIRY_MINUTES,
  };

  const recipientEmail = String(user?.employees?.email ?? "").trim();
  const mailDispatched = recipientEmail
    ? await sendResetPasswordEmail({
        toEmail: recipientEmail,
        recipientName: user?.employees?.fullName,
        verificationCode,
        resetUrl,
        expiresInMinutes: RESET_PASSWORD_EXPIRY_MINUTES,
      })
    : false;

  if (process.env.NODE_ENV !== "production") {
    response.resetToken = resetToken;
    response.resetUrl = resetUrl;
    response.verificationCode = verificationCode;
    response.mailDispatched = mailDispatched;
  }

  return response;
}

/** Memverifikasi token+kode reset lalu mengembalikan snapshot user untuk update password. */
async function resolveResetUserFromTokenAndCode(token: string, code: string) {
  if (!isValidCodeFormat(code)) {
    throw new Error(
      `Bad Request: Kode verifikasi harus ${RESET_CODE_LENGTH} digit.`,
    );
  }

  const tokenPayload = await verifyResetPasswordToken(token);
  if (!isCodeHashMatch(tokenPayload.codeHash, code)) {
    throw new Error("Bad Request: Kode verifikasi tidak valid.");
  }

  const user = await findUserPasswordSnapshotById(tokenPayload.userId);

  if (!user) {
    throw new Error("Bad Request: Token reset password tidak valid.");
  }

  if (user.updatedAt.getTime() !== tokenPayload.passwordUpdatedAtEpochMs) {
    throw new Error("Bad Request: Token reset password sudah tidak berlaku.");
  }

  return user;
}

/** Mengautentikasi kredensial user dan mengecek akses portal berdasarkan RBAC. */
async function authenticateUser(data: AuthLoginBodyPayload) {
  const user = await findLoginUserByNip(data.nip);

  if (!user) {
    throw new Error("Bad Request: NIP atau Password salah.");
  }

  const isPasswordValid = await verify(user.password, data.password);
  if (!isPasswordValid) {
    throw new Error("Bad Request: NIP atau Password salah.");
  }

  let hasWebAccessByRbac = false;

  if (user.rbacRole?.id && user.rbacRole.isActive) {
    if (user.rbacRole.canAccessAdmin) {
      hasWebAccessByRbac = true;
    } else {
      const webPortalPermission = await findWebPortalPermissionByRoleId(
        user.rbacRole.id,
      );
      hasWebAccessByRbac = Boolean(webPortalPermission);
    }
  }

  if (data.clientType === "WEB" && !hasWebAccessByRbac) {
    throw new Error(
      "Forbidden: Role Anda belum memiliki izin akses ke portal web.",
    );
  }

  return {
    id: user.id,
    employeeId: user.employees?.id || null,
    email: user.employees?.email || null,
    role: user.rbacRole?.key ?? null,
    rbacRoleKey: user.rbacRole?.key ?? null,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  };
}

/** Mengambil profil user terautentikasi beserta permission efektifnya. */
async function me(id: string, options?: AuthMeQueryPayload) {
  const user = await findUserProfileById(id, Boolean(options?.withEmployee));

  if (!user) {
    throw new Error("Not Found: User tidak ditemukan.");
  }

  const permissions = (user.rbacRole?.permissions ?? []).map((permission: any) => ({
    action: permission.action,
    resourceKey: permission.resource.key,
    resourceName: permission.resource.name,
    resourceRoutePath: permission.resource.routePath,
    groupName: permission.resource.groupName,
    supportsApprove: permission.resource.supportsApprove,
  }));

  return {
    ...user,
    role: user.rbacRole?.key ?? null,
    rbacRoleKey: user.rbacRole?.key ?? null,
    permissions,
  };
}

/** Menjalankan alur kirim kode verifikasi reset password. */
async function sendCode(data: AuthIdentifierBodyPayload) {
  return sendResetCodeByIdentifier(data.identifier);
}

/** Menjalankan alias legacy endpoint forgot-password. */
async function forgotPassword(data: AuthIdentifierBodyPayload) {
  return sendResetCodeByIdentifier(data.identifier);
}

/** Memverifikasi kode reset password sebelum proses ganti password. */
async function verifyCode(data: AuthVerifyCodeBodyPayload) {
  await resolveResetUserFromTokenAndCode(data.token, data.code);

  return {
    isValid: true,
  };
}

/** Memperbarui password user menggunakan token+kode verifikasi reset. */
async function resetPassword(data: AuthResetPasswordBodyPayload) {
  if (data.newPassword !== data.confirmPassword) {
    throw new Error("Bad Request: Konfirmasi password tidak sesuai.");
  }

  if (data.newPassword.length < constants.auth.passwordMinLength) {
    throw new Error(
      `Bad Request: Password minimal ${constants.auth.passwordMinLength} karakter.`,
    );
  }

  const user = await resolveResetUserFromTokenAndCode(data.token, data.code);

  const isSamePassword = await verify(user.password, data.newPassword);
  if (isSamePassword) {
    throw new Error(
      "Bad Request: Password baru tidak boleh sama dengan password lama.",
    );
  }

  const hashedPassword = await hash(data.newPassword);
  await updateUserPasswordById(user.id, hashedPassword);

  return {
    updated: true,
  };
}

/** Mengekspor AuthService untuk kebutuhan modul ini. */
export const AuthService = {
  authenticateUser,
  sendCode,
  forgotPassword,
  verifyCode,
  resetPassword,
  me,
};
