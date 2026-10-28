import test from 'node:test'; import assert from 'node:assert/strict'; import { resolveReportLanguage } from '../../src/application/report-language.js';
test('defaults report language to Spanish', () => { assert.equal(resolveReportLanguage([], {}), 'es'); });
test('uses environment language when no CLI value exists', () => { assert.equal(resolveReportLanguage([], { QA_REPORT_LANGUAGE: 'en' }), 'en'); });
test('CLI language overrides environment for both supported syntaxes', () => { assert.equal(resolveReportLanguage(['--lang=es'], { QA_REPORT_LANGUAGE: 'en' }), 'es'); assert.equal(resolveReportLanguage(['--lang', 'en'], { QA_REPORT_LANGUAGE: 'es' }), 'en'); });
test('rejects unsupported languages', () => { assert.throws(() => resolveReportLanguage(['--lang=fr'], {}), /Unsupported report language/); });
