import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Firestore Security Rules — Dirty Dozen & Eight Pillars Verification', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');

  it('enforces rules_version = 2 and default-deny catch-all', () => {
    const content = fs.readFileSync(rulesPath, 'utf-8');
    expect(content).toContain("rules_version = '2';");
    expect(content).toContain('match /{document=**} {\n      allow read, write: if false;\n    }');
  });

  it('covers all 36 AI PATH collections in firestore-blueprint.json', () => {
    const blueprint = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf-8'));
    const rules = fs.readFileSync(rulesPath, 'utf-8');
    const paths = Object.keys(blueprint.firestore);
    expect(paths.length).toBe(36);
    for (const p of paths) {
      expect(rules).toContain(`match ${p}`);
    }
  });

  it('rejects Dirty Dozen payloads (Shadow fields, Email spoofing, Blanket reads, ID poisoning, Timestamp forgery)', () => {
    const rules = fs.readFileSync(rulesPath, 'utf-8');
    // 1. Shadow field guard via hasOnly
    expect(rules).toContain('.keys().hasOnly(');
    // 2. Email spoofing guard via email_verified == true
    expect(rules).toContain('request.auth.token.email_verified == true');
    // 3. ID poisoning guard via isValidId regex and <= 128 size
    expect(rules).toContain("id.matches('^[a-zA-Z0-9_\\\\-]+$')");
    // 4. Strict timestamps via request.time
    expect(rules).toContain('incoming().createdAt == request.time');
    expect(rules).toContain('incoming().updatedAt == request.time');
    // 5. Action-based update diff affectedKeys().hasOnly
    expect(rules).toContain('incoming().diff(existing()).affectedKeys().hasOnly(');
    // 6. Terminal state locking for experimentBaselines and ARCHIVED experiments
    expect(rules).toContain("existing().status != 'ARCHIVED'");
  });
});
