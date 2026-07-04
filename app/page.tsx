"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TwynLogo, TwynMark } from "@/components/Logo";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <div className="flex justify-center pt-8">
        <TwynMark size={88} />
      </div>
      <h1 className="mt-6 text-center text-5xl font-extrabold tracking-tight">
        <span className="grad-text">twyn</span>
      </h1>
      <p className="mt-3 text-center text-lg text-white/60">
        find your twin in the room ✨
        <br />
        <span className="text-sm">
          timed rounds · matching symbols · zero awkward wandering
        </span>
      </p>

      <div className="card mt-10">
        <label className="text-sm font-semibold text-white/60">
          Got an event code?
        </label>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) router.push(`/e/${code.trim().toUpperCase()}`);
          }}
        >
          <input
            className="input flex-1 text-center text-xl font-bold uppercase tracking-[0.3em]"
            placeholder="ABC12"
            maxLength={5}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="btn-primary" disabled={code.trim().length < 5}>
            Join
          </button>
        </form>
      </div>

      <div className="my-6 flex items-center gap-3 text-white/30">
        <div className="h-px flex-1 bg-white/10" />
        or
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <button
        className="btn-ghost w-full text-lg"
        onClick={() => router.push("/create")}
      >
        🪩 Host an event
      </button>

      <div className="mt-auto pt-12 text-center text-xs text-white/25">
        how it works: register → check in at the door → every round you get a
        match + a shared symbol → find the person showing the same one 💫
      </div>
    </main>
  );
}
