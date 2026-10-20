# AI PATH V1.0 — Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants & Master Source of Truth
1. **Default-Deny Catch-All**: All paths default to `allow read, write: if false;`.
2. **Tenant Isolation (`schoolId`)**: Every document across all 36 collections must include a valid `schoolId` (`isValidId(data.schoolId)`). A user from School A can never read or write documents belonging to School B.
3. **Role-Based Access Control (RBAC)**:
   - **Bootstrapped Admin**: `request.auth.token.email == "Hoanghac2dv@gmail.com" && request.auth.token.email_verified == true` or verified existence in `/admins/$(request.auth.uid)`.
   - **Student Isolation**: Students can only read/list records where `resource.data.studentId == request.auth.uid` or `resource.data.userId == request.auth.uid`.
   - **Teacher Scope**: Teachers can only read/write records within their `schoolId` and assigned classes.
4. **No Plaintext Passwords / PII Protection**: User documents cannot be read via blanket `isSignedIn()` queries; `get` and `list` require owner identity (`userId == request.auth.uid`) or verified admin/teacher role within the same `schoolId`.
5. **Strict Timestamps & Immutable Fields**: `createdAt == request.time` on creation; `updatedAt == request.time` on update; `schoolId`, `createdBy`, and `createdAt` are immutable across updates.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection**: Creating a `/schools/school_1` document with an extra undeclared field `{"isSuperTenant": true}` -> `PERMISSION_DENIED`.
2. **Email Spoofing (Unverified Admin)**: Calling an admin write with `email == "Hoanghac2dv@gmail.com"` but `email_verified == false` -> `PERMISSION_DENIED`.
3. **Cross-Tenant Read**: User in `school_A` attempting `get` or `list` on `/learningPaths` with `schoolId == "school_B"` -> `PERMISSION_DENIED`.
4. **Student Reading Another Student's Diagnostic**: Student `uid_1` querying `/attempts` where `studentId == "uid_2"` -> `PERMISSION_DENIED`.
5. **Privilege Escalation on User Profile**: User updating their own `/users/{uid}` document to change `role` from `"STUDENT"` to `"ADMIN"` -> `PERMISSION_DENIED`.
6. **Student Self-Approving Learning Path**: Student updating `/learningPaths/{pathId}` to set `status: "APPROVED"` -> `PERMISSION_DENIED`.
7. **ID Poisoning**: Creating a document with a 1,500-character ID or invalid characters `id_with_spaces_and_$#@!` -> `PERMISSION_DENIED`.
8. **Value Poisoning on Update**: Updating `status` on `/users/{uid}` with a number `12345` or 1MB string instead of valid enum -> `PERMISSION_DENIED`.
9. **Terminal State Bypass**: Attempting to modify a locked `/experimentBaselines/{id}` or `ARCHIVED` `/experiments/{id}` as a non-admin -> `PERMISSION_DENIED`.
10. **Timestamp Forgery**: Client passing a past or future `createdAt` timestamp not equal to `request.time` -> `PERMISSION_DENIED`.
11. **Ownership Hijacking (`createdBy` / `schoolId` Mutation)**: Updating a document to change `schoolId` or `createdBy` -> `PERMISSION_DENIED`.
12. **Blanket List Scraping**: Executing an unfiltered `list` query on `/users` or `/responses` without matching `userId == request.auth.uid` -> `PERMISSION_DENIED`.
