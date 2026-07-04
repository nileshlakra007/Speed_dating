"use client";

import { useEffect, useState } from "react";

/**
 * Counts down to `endsAt` (server time), corrected by the offset between
 * server clock and this device's clock.
 */
export function Countdown({
  endsAt,
  serverNow,
  className = "",
}: {
  endsAt: number;
  serverNow: number;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const [, tick] = useState(0);

  useEffect(() => {
    setOffset(serverNow - Date.now());
  }, [serverNow]);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.max(0, endsAt - (Date.now() + offset));
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);

  return (
    <span className={`tabular-nums font-mono ${className}`}>
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}
