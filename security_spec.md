# Security Specification — SIMS Terpadu (Multi-Tenant `schoolId` & Multi-Role Auth)

## 1. Data Invariants

1. **First-Account Tenant Bootstrap Lock (`/system_config/bootstrap`)**:
   - Public registration of a `school_admin` and `schools/{schoolId}` is permitted **only** when `/system_config/bootstrap` does not exist yet (`!exists(/databases/$(database)/documents/system_config/bootstrap)`), executed via an atomic Firestore transaction.
   - Once `/system_config/bootstrap` is created (`initialized == true`), `allow create, update, delete: if false;` on `/system_config/bootstrap` permanently blocks any subsequent public `school_admin` registration or overwrite.
2. **Username Uniqueness & PII-Minimized Lookup**:
   - Global `/username_lookup/{lookupKey}` stores only `{ lookupKey, usernameKey, schoolId, uid, authEmail, isActive, updatedAt }` — never passwords, password hashes, phone numbers, or personal details.
   - `allow get: if isValidId(lookupKey); allow list: if false;` prevents directory enumeration while enabling `username + password` login.
   - Per-school `/schools/{schoolId}/username_index/{usernameKey}` enforces atomic per-tenant username reservation writable only by `school_admin` (or during initial bootstrap).
3. **RBAC Role Standardization & Non-Escalation**:
   - Canonical roles: `school_admin`, `principal`, `teacher`, `staff`, `student`, `parent`.
   - Users can never modify their own `role`, `schoolId`, `isActive`, or `uid` on `/users/{uid}` or `/schools/{schoolId}/users/{uid}`.
   - Only `school_admin` within the same `schoolId` can create, edit, activate/deactivate, or delete user profiles in their school tenant.
4. **Disabled Account & First-Login Password Lockout**:
   - Inactive accounts (`isActive == false`) are blocked from domain reads/writes in Firestore Rules and immediately signed out on the client.
   - Accounts with `mustChangePassword == true` (`principal`, `teacher`, `staff`) are blocked from writing to domain collections until `mustChangePassword` is cleared to `false` after `updatePassword` in Firebase Auth.
5. **Multi-Tenant Isolation (`schoolId`)**:
   - Every domain record (`assignments`, `assignment_submissions`, `submission_history`, `assignment_notifications`, `academic_grades`, `school_locations`, `parent_student_relations`, `import_jobs`, `audit_logs`, etc.) MUST contain a valid `schoolId` matching the authenticated user's school tenant.
6. **Parent-Student Isolation**:
   - `parent` users can read academic grades, submissions, and student records only for students linked via `/schools/{schoolId}/parent_student_relations/{relationId}` or `linkedStudentIds` / `childStudentId`.
7. **Assignment Ownership & Immutable History/Audit**:
   - Teachers can only create, update, or verify `assignments` and `assignment_submissions` where `teacherId == request.auth.uid` (unless `principal`/`school_admin`).
   - Students cannot self-approve (`status == 'approved'`) or inject shadow fields. `submission_history` and `audit_logs` are strictly append-only (`allow update, delete: if false;`).
8. **Multi-Location Geofencing & One-Vote OSIS**:
   - Only `school_admin` or `principal` in the matching `schoolId` can manage `school_locations` (bounds: lat -90..90, lon -180..180, radius 10..5000 m).
   - OSIS votes (`osis_votes/{schoolId}_{voterId}`) forbid updates/deletes to enforce 1 student = 1 vote.

## 2. The "Dirty Dozen" Attack Payloads

1. **Duplicate First-Admin Takeover**: Unauthenticated user tries to register a second `school_admin` after `/system_config/bootstrap` exists -> `PERMISSION_DENIED`.
2. **Self-Role Escalation**: Student or staff updates `/users/{uid}` setting `role: "school_admin"` -> `PERMISSION_DENIED`.
3. **Cross-Tenant User Provisioning**: `school_admin` of `school-A` creates user under `/schools/school-B/users/{uid}` -> `PERMISSION_DENIED`.
4. **Username Enumeration**: Attacker runs `list` query on `/username_lookup` to dump all usernames -> `PERMISSION_DENIED`.
5. **Disabled User Domain Write**: Deactivated user (`isActive: false`) attempts to submit assignment or read grades -> `PERMISSION_DENIED`.
6. **Bypassing Mandatory First-Login Password Change**: Newly created `teacher` (`mustChangePassword: true`) tries to write to `academic_grades` before changing password -> `PERMISSION_DENIED`.
7. **Parent Spying on Unlinked Student**: Parent A reads `academic_grades` of Student B (not in `linkedStudentIds`) -> `PERMISSION_DENIED`.
8. **Plaintext Password Injection**: Client attempts to write `password` or `passwordHash` into `/users/{uid}` -> `PERMISSION_DENIED` (`hasOnly` rejects unknown keys).
9. **Self-Approval Escalation in E-Tugas**: Student updates `assignment_submissions` setting `status: "approved"` and `score: 100` -> `PERMISSION_DENIED`.
10. **History & Audit Tampering**: Any user attempts to `update` or `delete` `submission_history` or `audit_logs` -> `PERMISSION_DENIED`.
11. **Path ID Poisoning**: Attacker writes document with >128 char ID or `../admin` -> `PERMISSION_DENIED`.
12. **Double OSIS Voting**: Student attempts to overwrite or delete existing `osis_votes` document -> `PERMISSION_DENIED`.
