"use client";

import { useRef, useState } from "react";

/** Center-crop to a square and downscale to 256px JPEG (~30–60KB). */
async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    256,
    256
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process image"))),
      "image/jpeg",
      0.85
    )
  );
}

export function PhotoPicker({
  url,
  onChange,
}: {
  url: string | null;
  onChange: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pick = async (file: File) => {
    setBusy(true);
    setErr("");
    try {
      const small = await downscale(file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: small,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Upload failed");
      onChange(json.url);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-dashed border-white/25 bg-white/[0.04] transition hover:border-brand/60"
        onClick={() => input.current?.click()}
        disabled={busy}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Your photo" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xl text-white/40">{busy ? "…" : "📷"}</span>
        )}
      </button>
      <div className="flex-1">
        <p className="text-sm text-white/60">
          {url ? "Looking good." : "Add a photo so your match spots you faster."}
        </p>
        <div className="mt-0.5 flex gap-3 text-xs">
          <button
            type="button"
            className="font-semibold text-brand-light/90 hover:text-brand-light"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            {busy ? "Uploading…" : url ? "Change" : "Choose photo (optional)"}
          </button>
          {url && (
            <button
              type="button"
              className="text-white/40 hover:text-white/70"
              onClick={() => onChange(null)}
            >
              Remove
            </button>
          )}
        </div>
        {err && <p className="mt-1 text-xs text-red-300/90">{err}</p>}
      </div>
    </div>
  );
}

export function Avatar({
  user,
  size = 36,
  className = "",
}: {
  user: { photoUrl?: string | null; emoji: string; name: string };
  size?: number;
  className?: string;
}) {
  if (user.photoUrl)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.photoUrl}
        alt={user.name}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-white/[0.06] ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {user.emoji}
    </span>
  );
}
