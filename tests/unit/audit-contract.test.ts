import test from 'node:test'; import assert from 'node:assert/strict';
import { parseStructuredAudit, StructuredAuditError } from '../../src/infrastructure/integrations/claude/claude.adapter.js';
import { AUDIT_SCHEMA_VERSION } from '../../src/domain/audit-contract.js'; import { validAudit } from '../fixtures/audit.js';
test('parses a valid structured audit', () => { assert.equal(parseStructuredAudit(JSON.stringify(validAudit())).ticketKey, 'AGSVK-5234'); });
test('rejects malformed and incomplete audit output', () => { assert.throws(() => parseStructuredAudit('{'), StructuredAuditError); assert.throws(() => parseStructuredAudit(JSON.stringify({ schemaVersion: AUDIT_SCHEMA_VERSION })), StructuredAuditError); });
test('rejects duplicated test scenario IDs', () => { const audit = validAudit(); audit.testScenarios.push({ ...audit.testScenarios[0] }); assert.throws(() => parseStructuredAudit(JSON.stringify(audit)), StructuredAuditError); });
