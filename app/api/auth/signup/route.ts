import { NextResponse } from "next/server";
import { handle, id } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { getAccountByEmail, saveAccount } from "@/lib/store";
import { ApiError, Account } from "@/lib/types";

export const POST = handle(async (req) => {
  const body = await req.json();
  const name = String(body.name ?? "").trim().slice(0, 50);
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!name) throw new ApiError("Enter your name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ApiError("Enter a valid email");
  if (password.length < 8)
    throw new ApiError("Password needs at least 8 characters");

  const existing = await getAccountByEmail(email);
  if (existing)
    throw new ApiError("An account with this email already exists — sign in instead", 409);

  const account: Account = {
    id: id(16),
    name,
    email,
    passwordHash: await hashPassword(password),
    events: [],
    createdAt: Date.now(),
  };
  await saveAccount(account);
  const session = await createSession(account.id);
  return NextResponse.json({ session, name: account.name, email });
});
