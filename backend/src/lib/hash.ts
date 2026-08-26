import { createHash } from 'node:crypto';

// One-way hash for opaque bearer tokens (session tokens, password reset
// tokens) — we store only this, never the raw token, so a DB read can't be
// replayed as a credential.
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
