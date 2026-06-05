import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getInternalEvalPassword,
  INTERNAL_EVAL_COOKIE,
  signInternalEvalToken,
} from "@/lib/evalInternal/auth";

function verifySubmittedPassword(
  submitted: string,
  expected: string,
): boolean {
  try {
    return timingSafeEqual(Buffer.from(submitted), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const runtime = "nodejs";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(req: Request) {
  const password = getInternalEvalPassword();
  if (!password) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const submitted =
    typeof body === "object" &&
    body !== null &&
    "password" in body &&
    typeof (body as { password: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";

  if (!verifySubmittedPassword(submitted, password)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(INTERNAL_EVAL_COOKIE, signInternalEvalToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/internal",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(INTERNAL_EVAL_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/internal",
    maxAge: 0,
  });
  return res;
}
