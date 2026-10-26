
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const prompt = `
Usa el agente qa-auditor para analizar
tests/example.spec.ts.

Evalúa:
- Cobertura funcional
- Riesgos técnicos
- Casos faltantes
- Regresiones potenciales
- Pruebas visuales recomendadas

No modifiques archivos.
No inventes resultados de ejecución.

Genera un reporte de QA en Markdown.
`;

try {
    const result = spawnSync(
        'claude',
        [
            '--print',
            '--output-format', 'text',
            '--tools', 'Read,Glob,Grep,Task'
        ],
        {
            input: prompt,
            encoding: 'utf8',
            shell: true,
            maxBuffer: 10 * 1024 * 1024,
            timeout: 180000
        }
    );

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(result.stderr || 'Claude failed');
    }

    const report = result.stdout.trim();

    if (!report) {
        throw new Error('Claude returned an empty report');
    }

    mkdirSync('reports', { recursive: true });

    writeFileSync(
        'reports/qa-report.md',
        report + '\n',
        'utf8'
    );

    console.log('Reporte generado: reports/qa-report.md');
} catch (error) {
    console.error('Error ejecutando Claude Code:');
    console.error(error.message);
    process.exit(1);
}
