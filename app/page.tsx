"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TwynMark } from "@/components/Logo";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <div className="flex justify-center pt-10">
        <TwynMark size={72} />
      </div>
      <h1 className="mt-8 text-center font-display text-6xl font-medium tracking-tight">
        <span className="grad-text">twyn</span>
      </h1>
      <p className="mt-4 text-center text-white/50">
        Find your twin in the room.
      </p>
      <p className="mt-1 text-center text-xs uppercase tracking-[0.2em] text-white/25">
        timed rounds · matched symbols · in person
      </p>

      <div className="card mt-12">
        <p className="label">Invited to an event?</p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) router.push(`/e/${code.trim().toUpperCase()}`);
          }}
        >
          <input
            className="input flex-1 text-center text-xl font-semibold uppercase tracking-[0.3em]"
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

      <div className="my-8 flex items-center gap-4 text-xs uppercase tracking-widest text-white/20">
        <div className="hairline flex-1" />
        or
        <div className="hairline flex-1" />
      </div>

      <button className="btn-ghost w-full" onClick={() => router.push("/create")}>
        Host an event
      </button>

      <p className="mt-auto pt-14 text-center text-xs leading-relaxed text-white/25">
        Register, check in at the door, and each round you&apos;re matched with
        someone in the room. You both see the same symbol — find the person
        showing it.
      </p>
    </main>
  );
}
