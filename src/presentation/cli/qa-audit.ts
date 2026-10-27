import { createQaOrchestrator } from '../../bootstrap/container.js'; import { issueKeyFromArgs, fail } from './common.js';
try { const app = createQaOrchestrator(); const result = await app.audit(issueKeyFromArgs()); const paths = await app.save(result.report, result.markdown); console.log(`Reporte generado: ${paths.markdownPath}\nDatos JSON: ${paths.jsonPath}`); } catch (error) { fail(error); }
