import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdminEmail } from '../src/security/adminAccess.js';

test('admin allowlist compares normalized email addresses', () => {
  assert.equal(isAdminEmail('Admin@Example.com', 'admin@example.com'), true);
});

test('admin allowlist supports multiple comma-separated administrators', () => {
  assert.equal(isAdminEmail('second@example.com', 'first@example.com, second@example.com'), true);
});

test('admin allowlist does not grant partial or substring matches', () => {
  assert.equal(isAdminEmail('notadmin@example.com', 'admin@example.com'), false);
});

test('empty admin allowlist denies administrator access by default', () => {
  assert.equal(isAdminEmail('admin@example.com', ''), false);
  assert.equal(isAdminEmail('admin@example.com', '   '), false);
});
