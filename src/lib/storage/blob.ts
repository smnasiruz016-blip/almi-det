// Vercel Blob wrapper. Mirrors almi-toefl src/lib/storage/blob.ts, narrowed to
// what AlmiDET needs: the pre-rendered TTS audio for Listen and Type prompts is
// written ONCE by scripts/generate-det-audio.mts and then served straight from
// the Blob CDN.
//
// The SERVING path never needs this token — /api/det/audio/[attemptId] only
// redirects to a public URL, and reading a public Blob URL requires no
// credential. Only the render script writes, and it runs locally.
// isBlobConfigured() therefore exists so the WRITE path can refuse cleanly
// rather than throw when the token is absent (CI, or before the store is
// connected). It must never gate the read path — see the note in the route.

import { put } from "@vercel/blob";

const TOKEN_ENV = "BLOB_READ_WRITE_TOKEN";

function getBlobToken(): string {
  const token = process.env[TOKEN_ENV];
  if (!token || token.length < 20 || token === "TODO_FOUNDER_PROVIDES") {
    throw new Error(
      `${TOKEN_ENV} missing or invalid — connect the Vercel Blob store to this project and set the token`,
    );
  }
  return token;
}

export function isBlobConfigured(): boolean {
  const token = process.env[TOKEN_ENV];
  return Boolean(token && token.length >= 20 && token !== "TODO_FOUNDER_PROVIDES");
}

export type StoredAudio = { url: string; pathname: string };

/**
 * Upload one pre-rendered MP3. `key` is a DETERMINISTIC path like
 * `det/audio/LISTEN_AND_TYPE/<itemId>.mp3` — no random suffix, overwrite
 * allowed — so re-rendering an item replaces it in place instead of
 * accumulating orphans, and the URL for a given item never changes.
 */
export async function putAudio(
  key: string,
  body: Buffer | ArrayBuffer,
  contentType = "audio/mpeg",
): Promise<StoredAudio> {
  const token = getBlobToken();
  const result = await put(key, body as Buffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });
  return { url: result.url, pathname: result.pathname };
}
