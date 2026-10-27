export function issueKeyFromArgs(): string { const key = process.argv[2]?.toUpperCase(); if (!key || !/^[A-Z][A-Z0-9_]+-\d+$/.test(key)) throw new Error('Uso: npm run qa:<comando> -- PROYECTO-123'); return key; }
export function fail(error: unknown): never { console.error(error instanceof Error ? error.message : 'Error desconocido'); process.exit(1); }
