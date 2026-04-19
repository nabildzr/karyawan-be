// * File ini menangani utilitas bersama untuk module auth.

import { createHash, timingSafeEqual } from "crypto";
import * as jose from "jose";
import nodemailer from "nodemailer";
import { constants } from "../../../config/constants";
import { AuthRepository } from "../repository";



export const RESET_PASSWORD_TOKEN_PURPOSE = "RESET_PASSWORD";


export const RESET_PASSWORD_EXPIRY_MINUTES = 15;


export const RESET_CODE_LENGTH = 6;



export type ResetTokenPayload = {
  userId: string;
  passwordUpdatedAtEpochMs: number;
  codeHash: string;
};



export type ResetCodeResponse = {
  expiresInMinutes: number;
  resetToken?: string;
  resetUrl?: string;
  verificationCode?: string;
  mailDispatched?: boolean;
};



export type SmtpMailConfig = {
  host: string;
  port: number;
  secure: boolean;
  fromEmail: string;
  fromName: string;
  auth?: {
    user: string;
    pass: string;
  };
};



export type SendResetPasswordEmailParams = {
  toEmail: string;
  recipientName?: string | null;
  verificationCode: string;
  resetUrl: string;
  expiresInMinutes: number;
};



export let smtpTransporter: nodemailer.Transporter | null = null;


export let smtpTransporterCacheKey = "";



export function parseBooleanEnv(value?: string) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return normalized === "1" || normalized === "true" || normalized === "yes";
}



export function getSmtpMailConfig(): SmtpMailConfig | null {
  const host = String(process.env.SMTP_HOST ?? "").trim();
  const portRaw = String(process.env.SMTP_PORT ?? "").trim();
  const port = Number(portRaw || "587");
  const user = String(process.env.SMTP_USER ?? "").trim();
  const pass = String(process.env.SMTP_PASS ?? "").trim();
  const fromEmail = String(
    process.env.SMTP_FROM_EMAIL || user || constants.server.email,
  ).trim();
  const fromName = String(
    process.env.SMTP_FROM_NAME || constants.server.name,
  ).trim();

  if (!host || !Number.isFinite(port) || !fromEmail) {
    return null;
  }

  const secure = parseBooleanEnv(process.env.SMTP_SECURE) || port === 465;
  const auth = user && pass ? { user, pass } : undefined;

  return {
    host,
    port,
    secure,
    fromEmail,
    fromName,
    auth,
  };
}



export function getSmtpTransporter(config: SmtpMailConfig) {
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
      auth: config.auth,
    });
    smtpTransporterCacheKey = transporterCacheKey;
  }

  return smtpTransporter;
}



export async function sendResetPasswordEmail(
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
    await transporter.sendMail({
      from: `${smtpConfig.fromName} <${smtpConfig.fromEmail}>`,
      to: params.toEmail,
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error("[auth] Gagal mengirim email reset password:", error);
    return false;
  }
}



export function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}



export function hashVerificationCode(code: string) {
  return createHash("sha256")
    .update(`${code}:${constants.auth.jwtSecret}`)
    .digest("hex");
}



export function isValidCodeFormat(code: string) {
  return /^\d{6}$/.test(code);
}



export function isCodeHashMatch(expectedHash: string, code: string) {
  const actualHash = hashVerificationCode(code);
  const expectedBuffer = Buffer.from(expectedHash);
  const actualBuffer = Buffer.from(actualHash);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}



export async function signResetPasswordToken(payload: ResetTokenPayload) {
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



export async function verifyResetPasswordToken(
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



export async function sendResetCodeByIdentifier(
  identifierRaw: string,
): Promise<ResetCodeResponse> {
  const db = AuthRepository.getClient();
  const identifier = identifierRaw.trim();

  if (!identifier) {
    throw new Error("Bad Request: Identifier wajib diisi.");
  }

  const user = await db.users.findFirst({
    where: {
      OR: [
        { nip: identifier },
        {
          employees: {
            is: {
              email: {
                equals: identifier,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      updatedAt: true,
      employees: {
        select: {
          email: true,
          fullName: true,
        },
      },
    },
  });

  // Gunakan data sintetis jika user tidak ditemukan agar mencegah user enumeration.
  const userId = user?.id ?? crypto.randomUUID();
  const passwordUpdatedAtEpochMs = user?.updatedAt.getTime() ?? Date.now();
  const verificationCode = generateVerificationCode();
  const resetToken = await signResetPasswordToken({
    userId,
    passwordUpdatedAtEpochMs,
    codeHash: hashVerificationCode(verificationCode),
  });

  const resetPath = `/admin/reset-password?token=${encodeURIComponent(resetToken)}`;
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



export async function resolveResetUserFromTokenAndCode(token: string, code: string) {
  if (!isValidCodeFormat(code)) {
    throw new Error(
      `Bad Request: Kode verifikasi harus ${RESET_CODE_LENGTH} digit.`,
    );
  }

  const tokenPayload = await verifyResetPasswordToken(token);
  if (!isCodeHashMatch(tokenPayload.codeHash, code)) {
    throw new Error("Bad Request: Kode verifikasi tidak valid.");
  }

  const db = AuthRepository.getClient();
  const user = await db.users.findUnique({
    where: { id: tokenPayload.userId },
    select: {
      id: true,
      password: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new Error("Bad Request: Token reset password tidak valid.");
  }

  if (user.updatedAt.getTime() !== tokenPayload.passwordUpdatedAtEpochMs) {
    throw new Error("Bad Request: Token reset password sudah tidak berlaku.");
  }

  return user;
}