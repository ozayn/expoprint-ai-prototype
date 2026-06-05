import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const INTERNAL_EVAL_COOKIE = "expoprint_internal_eval";

const AUTH_SALT = "expoprint-internal-eval-v1";

export function getInternalEvalPassword(): string | undefined {
  const value = process.env.INTERNAL_EVAL_PASSWORD?.trim();
  return value || undefined;
}

export function signInternalEvalToken(password: string): string {
  return createHmac("sha256", password).update(AUTH_SALT).digest("hex");
}

export function verifyInternalEvalToken(
  password: string,
  token: string | undefined,
): boolean {
  if (!token) return false;
  const expected = signInternalEvalToken(password);
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function isInternalEvalAuthenticated(): Promise<boolean> {
  const password = getInternalEvalPassword();
  if (!password) return false;
  const jar = await cookies();
  const token = jar.get(INTERNAL_EVAL_COOKIE)?.value;
  return verifyInternalEvalToken(password, token);
}
