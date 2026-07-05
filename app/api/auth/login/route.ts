import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { getAccountByEmail } from "@/lib/store";
import { ApiError } from "@/lib/types";

export const POST = handle(async (req) => {
  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const account = await getAccountByEmail(email);
  if (account && !account.passwordHash)
    throw new ApiError("This account uses Google sign-in — use the Google button", 400);
  if (
    !account ||
    !account.passwordHash ||
    !(await verifyPassword(password, account.passwordHash))
  )
    throw new ApiError("Wrong email or password", 401);

  const session = await createSession(account.id);
  return NextResponse.json({ session, name: account.name, email });
});
