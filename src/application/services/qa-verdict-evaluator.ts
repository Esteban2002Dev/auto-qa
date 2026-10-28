import type { StructuredAudit } from '../../domain/audit-contract.js';
import type { TestExecutionResult } from '../../domain/entities.js';
import type { QaVerdict } from '../../domain/entities.js';

export interface VerdictRules { requireFunctionalEvidence: boolean; }
const defaultRules: VerdictRules = { requireFunctionalEvidence: true };

export class QaVerdictEvaluator {
  constructor(private readonly rules: VerdictRules = defaultRules) {}
  evaluate(audit: StructuredAudit, testResults: TestExecutionResult[]): QaVerdict {
    if (audit.findings.some(finding => ['CRITICAL', 'HIGH'].includes(finding.severity) && ['OBSERVED', 'REPORTED'].includes(finding.verificationStatus))) return 'NOT_READY';
    if (audit.acceptanceCriteria.some(criterion => criterion.status === 'NOT_MET')) return 'NOT_READY';
    if (audit.acceptanceCriteria.some(criterion => criterion.status === 'BLOCKED')) return 'NEEDS_REVIEW';
    if (audit.dependenciesAndBlockers.length > 0) return 'NEEDS_REVIEW';
    if (audit.acceptanceCriteria.some(criterion => ['PARTIALLY_MET', 'NOT_TESTED', 'UNKNOWN'].includes(criterion.status) || criterion.evidence.length === 0)) return 'INSUFFICIENT_EVIDENCE';
    const needsFunctionalEvidence = this.rules.requireFunctionalEvidence && audit.testScenarios.some(scenario => scenario.testType === 'FUNCTIONAL');
    const hasFunctionalEvidence = testResults.some(result => result.status === 'PASSED');
    if (needsFunctionalEvidence && !hasFunctionalEvidence) return 'INSUFFICIENT_EVIDENCE';
    if (audit.humanReviewRequired) return 'NEEDS_REVIEW';
    return 'READY';
  }
}
