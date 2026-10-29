export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFormat = 'pretty' | 'json';
export type LogContext = Record<string, unknown>;
export interface LogSink { write(line: string): void; }
const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const sensitive = /token|authorization|password|secret|cookie/i;
const redact = (value: unknown): unknown => Array.isArray(value) ? value.map(redact) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sensitive.test(key) ? '[REDACTED]' : redact(item)])) : value;
export class Logger {
  constructor(private readonly level: LogLevel = 'info', private readonly format: LogFormat = 'pretty', private readonly sink: LogSink = { write: line => process.stdout.write(`${line}\n`) }, private readonly context: LogContext = {}) {}
  child(context: LogContext): Logger { return new Logger(this.level, this.format, this.sink, { ...this.context, ...context }); }
  debug(message: string, context: LogContext = {}): void { this.log('debug', message, context); } info(message: string, context: LogContext = {}): void { this.log('info', message, context); } warn(message: string, context: LogContext = {}): void { this.log('warn', message, context); } error(message: string, context: LogContext = {}): void { this.log('error', message, context); }
  private log(level: LogLevel, message: string, context: LogContext): void { if (order[level] < order[this.level]) return; const entry = { timestamp: new Date().toISOString(), level: level.toUpperCase(), message, ...redact({ ...this.context, ...context }) as LogContext }; if (this.format === 'json') return this.sink.write(JSON.stringify(entry)); const colors: Record<LogLevel, string> = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' }; const reset = '\x1b[0m'; const details = Object.entries(entry).filter(([key]) => !['timestamp', 'level', 'message'].includes(key)).map(([key, value]) => `${key}=${String(value)}`).join(' '); this.sink.write(`${entry.timestamp.slice(11, 19)} ${colors[level]}${entry.level}${reset} [${String((entry as LogContext).component ?? 'AUTO_QA')}] ${message}${details ? ` | ${details}` : ''}`); }
}
