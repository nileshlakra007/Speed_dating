import { OAuth2Client } from "google-auth-library";
import { NextResponse } from "next/server";
import { handle, id } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { getAccountByEmail, saveAccount } from "@/lib/store";
import { Account, ApiError } from "@/lib/types";

const clientId =
  process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const oauth = new OAuth2Client();

export const POST = handle(async (req) => {
  if (!clientId)
    throw new ApiError("Google sign-in is not configured on this server", 501);

  const body = await req.json();
  const credential = String(body.credential ?? "");
  if (!credential) throw new ApiError("Missing Google credential");

  let payload;
  try {
    const ticket = await oauth.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError("Google sign-in could not be verified", 401);
  }
  if (!payload?.email || !payload.email_verified || !payload.sub)
    throw new ApiError("Google account has no verified email", 403);

  const email = payload.email.toLowerCase();
  let account = await getAccountByEmail(email);
  if (account) {
    // link Google to an existing (e.g. password-created) account
    if (account.googleSub && account.googleSub !== payload.sub)
      throw new ApiError("This email is linked to a different Google account", 403);
    account.googleSub = payload.sub;
    account.picture = payload.picture ?? account.picture;
    if (!account.name && payload.name) account.name = payload.name;
    await saveAccount(account);
  } else {
    account = {
      id: id(16),
      name: (payload.name ?? email.split("@")[0]).slice(0, 50),
      email,
      googleSub: payload.sub,
      picture: payload.picture,
      events: [],
      createdAt: Date.now(),
    } satisfies Account;
    await saveAccount(account);
  }

  const session = await createSession(account.id);
  return NextResponse.json({ session, name: account.name, email });
});
