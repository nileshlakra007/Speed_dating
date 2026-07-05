"use client";

import { useEffect, useRef, useState } from "react";
import { api, saveSession } from "@/lib/client";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * Renders Google's official Sign in with Google button (GIS). The button
 * returns an ID token; the server verifies it against Google's certs and
 * mints our own session. Renders nothing when the client id isn't set.
 */
export function GoogleSignIn({ onAuthed }: { onAuthed: (name: string) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const onAuthedRef = useRef(onAuthed);
  onAuthedRef.current = onAuthed;
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!CLIENT_ID || !slot.current) return;

    const render = () => {
      const g = (window as any).google;
      if (!g?.accounts?.id || !slot.current) return;
      g.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          try {
            const res = await api<{ session: string; name: string }>(
              "/api/auth/google",
              { credential: resp.credential }
            );
            saveSession(res.session, res.name);
            onAuthedRef.current(res.name);
          } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : "Google sign-in failed");
          }
        },
      });
      g.accounts.id.renderButton(slot.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 280,
      });
    };

    if ((window as any).google?.accounts?.id) {
      render();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", render);
      return () => existing.removeEventListener("load", render);
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, []);

  if (!CLIENT_ID) return null;
  return (
    <div>
      <div ref={slot} className="flex justify-center" />
      {err && <p className="mt-2 text-center text-sm text-red-300/90">{err}</p>}
    </div>
  );
}
