import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

export interface VerifiedFirebaseIdentity {
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
}

type CustomVerifier = (idToken: string) => Promise<VerifiedFirebaseIdentity>;
let testVerifierOverride: CustomVerifier | null = null;

/**
 * Only used in automated Vitest security tests to simulate verified vs forged/unprovisioned tokens
 */
export function setTestIdTokenVerifier(verifier: CustomVerifier | null): void {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    testVerifierOverride = verifier;
  }
}

function getFirebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (raw.projectId) {
        return String(raw.projectId);
      }
    }
  } catch {
    // ignore read error
  }
  return 'gen-lang-client-0171700482';
}

let adminApp: App | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps();
  if (existing.length > 0) {
    adminApp = existing[0];
    return adminApp;
  }
  const projectId = getFirebaseProjectId();
  adminApp = initializeApp({ projectId });
  return adminApp;
}

/**
 * Verifies a Firebase ID Token using Firebase Admin SDK.
 * Never trusts client-provided uid, email, displayName, or role.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseIdentity> {
  const cleanToken = String(idToken || '').trim();
  if (!cleanToken) {
    throw new Error('MISSING_ID_TOKEN');
  }

  if (testVerifierOverride && (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test')) {
    return testVerifierOverride(cleanToken);
  }

  const app = getAdminApp();
  const decoded: DecodedIdToken = await getAuth(app).verifyIdToken(cleanToken);

  return {
    uid: decoded.uid,
    email: decoded.email,
    emailVerified: Boolean(decoded.email_verified),
    displayName: decoded.name,
  };
}
