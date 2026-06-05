import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const EVAL_VIEWER_COOKIE = "expoprint_eval_access";

const AUTH_SALT = "expoprint-eval-viewer-v1";

export function getEvalViewerPassword(): string | undefined {
  const value = process.env.EVAL_VIEWER_PASSWORD?.trim();
  return value || undefined;
}

export function isEvalViewerConfiguredInProduction(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return Boolean(getEvalViewerPassword());
}

export function signEvalViewerToken(password: string): string {
  return createHmac("sha256", password).update(AUTH_SALT).digest("hex");
}

export function verifyEvalViewerToken(
  password: string,
  token: string | undefined,
): boolean {
  if (!token) return false;
  const expected = signEvalViewerToken(password);
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function isEvalViewerAuthenticated(): Promise<boolean> {
  const password = getEvalViewerPassword();
  if (!password) {
    return process.env.NODE_ENV !== "production";
  }
  const jar = await cookies();
  const token = jar.get(EVAL_VIEWER_COOKIE)?.value;
  return verifyEvalViewerToken(password, token);
}
