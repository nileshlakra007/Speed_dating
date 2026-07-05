/**
 * Local-dev avatar storage: keeps uploaded images in process memory and
 * serves them from /api/upload/[id]. Used only when Vercel Blob isn't
 * configured AND we're not running on Vercel (serverless instances don't
 * share memory). Images vanish on server restart — fine for local testing.
 */
const g = globalThis as unknown as { __twynAvatars?: Map<string, Uint8Array> };

export const devAvatars = (g.__twynAvatars ??= new Map<string, Uint8Array>());

export const devAvatarsEnabled =
  !process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL;
