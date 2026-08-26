// One interface, two implementations (local.ts for dev/test, s3.ts for
// production) — admin upload and public/contractor-doc read routes code
// against this and never know which is backing them.
export interface StorageAdapter {
  /** Where the client should PUT the raw file bytes for this key. */
  createUploadTarget(key: string, contentType: string): Promise<{ uploadUrl: string; method: 'PUT' }>;
  /** Stable, unsigned URL for a public asset (material/team/clearance/tool images). */
  getPublicUrl(key: string): string;
  /** Short-lived signed URL for a gated download (contractor docs). */
  getSignedDownloadUrl(key: string, ttlSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

export type UploadPurpose = 'materials' | 'team' | 'clearance' | 'tools' | 'contractor-docs';

// Public-image purposes live under a public/ prefix (served with no token
// check); contractor docs live under private/ (GET requires a valid signed
// token) — see modules/uploads/routes.ts for how the local driver enforces
// this split.
export function isPrivatePurpose(purpose: UploadPurpose): boolean {
  return purpose === 'contractor-docs';
}

export function buildObjectKey(purpose: UploadPurpose, filename: string): string {
  const prefix = isPrivatePurpose(purpose) ? 'private' : 'public';
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}/${purpose}/${unique}-${safeName}`;
}
