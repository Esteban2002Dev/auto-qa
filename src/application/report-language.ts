export const reportLanguages = ['es', 'en'] as const;
export type ReportLanguage = typeof reportLanguages[number];
export function resolveReportLanguage(args: readonly string[], environment: { QA_REPORT_LANGUAGE?: string }): ReportLanguage {
  let cliLanguage: string | undefined;
  for (let index = 0; index < args.length; index++) { const argument = args[index]; if (argument.startsWith('--lang=')) cliLanguage = argument.slice('--lang='.length); else if (argument === '--lang') cliLanguage = args[index + 1]; }
  const value = cliLanguage ?? environment.QA_REPORT_LANGUAGE ?? 'es';
  if (!reportLanguages.includes(value as ReportLanguage)) throw new Error(`Unsupported report language "${value}". Allowed languages: ${reportLanguages.join(', ')}.`);
  return value as ReportLanguage;
}
