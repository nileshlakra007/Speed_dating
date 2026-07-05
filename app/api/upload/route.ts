import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { handle, id } from "@/lib/api";
import { devAvatars, devAvatarsEnabled } from "@/lib/devAvatars";
import { ApiError } from "@/lib/types";

/** Avatar upload. The client downsizes to ~256px JPEG before sending,
 * so payloads stay tiny; we cap at 500KB as a backstop. Stores in Vercel
 * Blob when configured, or in-memory locally (see lib/devAvatars). */
export const POST = handle(async (req) => {
  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobConfigured && !devAvatarsEnabled)
    throw new ApiError("Photo uploads are not configured on this server", 501);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/"))
    throw new ApiError("Send an image");

  const bytes = await req.arrayBuffer();
  if (bytes.byteLength === 0) throw new ApiError("Empty image");
  if (bytes.byteLength > 500_000)
    throw new ApiError("Image too large — try a smaller photo");

  if (blobConfigured) {
    const blob = await put(`avatars/${id(20)}.jpg`, bytes, {
      access: "public",
      contentType: "image/jpeg",
    });
    return NextResponse.json({ url: blob.url });
  }

  const avatarId = id(20);
  devAvatars.set(avatarId, new Uint8Array(bytes));
  return NextResponse.json({ url: `/api/upload/${avatarId}` });
});
