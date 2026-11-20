import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

test('Firestore rules enforce Eight Pillars, Auth, Bootstrap Lock, and Dirty Dozen invariants', () => {
  const rules = fs.readFileSync(rulesPath, 'utf8');

  // 1. Default deny catch-all at top
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);

  // 2. Path variable hardening (isValidId & isValidUsernameKey)
  assert.match(rules, /function isValidId\(id\)/);
  assert.match(rules, /function isValidUsernameKey\(key\)/);

  // 3. Multi-tenant Admin self-registration requires verified email, fresh user & fresh school tenant atomically
  assert.match(rules, /match \/system_config\/bootstrap[\s\S]*allow create, update, delete: if false;/);
  assert.match(rules, /function isValidAdminSelfRegistrationCommit\(schoolId\)[\s\S]*request\.auth\.token\.email_verified == true/);
  assert.match(rules, /!userDocExists\(\)/);
  assert.match(rules, /!exists\(\/databases\/\$\(database\)\/documents\/schools\/\$\(schoolId\)\)/);
  assert.match(rules, /existsAfter\(\/databases\/\$\(database\)\/documents\/schools\/\$\(schoolId\)\)/);
  assert.match(rules, /getAfter\(\/databases\/\$\(database\)\/documents\/schools\/\$\(schoolId\)\)\.data\.adminUid == request\.auth\.uid/);
  assert.match(rules, /getAfter\(\/databases\/\$\(database\)\/documents\/users\/\$\(request\.auth\.uid\)\)\.data\.role == 'school_admin'/);

  // 4. Username lookup forbids list enumeration and blocks non-admin writes
  assert.match(rules, /match \/username_lookup\/\{lookupKey\}[\s\S]*allow get: if isValidUsernameKey\(lookupKey\);\s*allow list: if false;/);

  // 5. Multi-role standardization and self-escalation prevention
  assert.match(rules, /data\.role in \['school_admin', 'principal', 'teacher', 'staff', 'student', 'parent'\]/);
  assert.match(rules, /incoming\(\)\.role == existing\(\)\.role && incoming\(\)\.isActive == existing\(\)\.isActive/);

  // 6. Active user & mustChangePassword gate on domain operations
  assert.match(rules, /function isActiveUser\(\)/);
  assert.match(rules, /function isPasswordReady\(\)/);
  assert.match(rules, /userDoc\(\)\.mustChangePassword != true/);

  // 7. Tenant-isolated subcollections under /schools/{schoolId} & self-registration commit support on audit_logs
  assert.match(rules, /match \/users\/\{userId\}/);
  assert.match(rules, /match \/parent_student_relations\/\{relationId\}/);
  assert.match(rules, /match \/username_index\/\{usernameKey\}/);
  assert.match(rules, /match \/import_jobs\/\{jobId\}/);
  assert.match(rules, /match \/audit_logs\/\{logId\}[\s\S]*isValidAdminSelfRegistrationCommit\(schoolId\)/);
  assert.match(rules, /function isValidAuditLog\(data\)[\s\S]*hasOnly\(\['id', 'schoolId', 'actorId'/);

  // 8. Submission history & audit logs are strictly append-only (no update/delete)
  assert.match(rules, /match \/submission_history\/\{historyId\}[\s\S]*allow update, delete: if false;/);
  assert.match(rules, /match \/audit_logs\/\{logId\}[\s\S]*allow update, delete: if false;/);

  // 9. Student cannot self-approve or modify teacherFeedback/score
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['photoUrls', 'studentNote', 'status', 'submittedAt', 'updatedAt'\]\)/);

  // 10. Revision requested requires mandatory feedback
  assert.match(rules, /incoming\(\)\.status != 'revision_requested' \|\| \(incoming\(\)\.teacherFeedback is string && incoming\(\)\.teacherFeedback\.size\(\) >= 3\)/);

  // 11. OSIS vote enforces deterministic single-vote doc ID and forbids overwrite/delete
  assert.match(rules, /voteId == \(incoming\(\)\.schoolId \+ '_' \+ request\.auth\.uid\)/);
  assert.match(rules, /match \/osis_votes\/\{voteId\}[\s\S]*allow update, delete: if false;/);

  // 12. School locations multi-location geofence rules enforce admin/principal ownership and coordinate/radius bounds
  assert.match(rules, /function isValidSchoolLocation\(data\)/);
  assert.match(rules, /match \/school_locations\/\{locationId\}[\s\S]*isLeadershipInSchool\(incoming\(\)\.schoolId\)/);
  assert.match(rules, /data\.radiusInMeters >= 10 && data\.radiusInMeters <= 5000/);
  assert.match(rules, /gpsAnomalyFlag/);

  // 13. No forbidden E-Rapor / CBT / Keuangan / Sarpras collections in rules or blueprint
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));
  const collectionKeys = Object.keys(blueprint.firestore || {}).join(' ');
  const entityKeys = Object.keys(blueprint.entities || {}).join(' ');
  assert.equal(/e_rapor|rapor|cbt|ujian|keuangan|bendahara|sarpras|inventaris/i.test(collectionKeys + ' ' + entityKeys), false);
  assert.equal(/match \/(e_rapor|rapor|cbt|ujian|keuangan|bendahara|sarpras|inventaris)/i.test(rules), false);
});

