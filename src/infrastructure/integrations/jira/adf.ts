export interface AdfNode { type?: string; text?: string; attrs?: Record<string, unknown>; content?: AdfNode[]; }
export function adfToMarkdown(node: AdfNode | string | null | undefined, depth = 0): string {
  if (!node) return ''; if (typeof node === 'string') return node; const content = (node.content ?? []).map(x => adfToMarkdown(x, depth + 1)).join('');
  if (node.type === 'text') return node.text ?? ''; if (node.type === 'hardBreak') return '\n'; if (node.type === 'inlineCard') return String(node.attrs?.url ?? '');
  if (node.type === 'link') return `[${content}](${String(node.attrs?.href ?? '')})`; if (node.type === 'codeBlock') return `\n\`\`\`\n${content.trim()}\n\`\`\`\n`;
  if (node.type === 'heading') return `\n${'#'.repeat(Number(node.attrs?.level ?? 1))} ${content.trim()}\n`; if (node.type === 'bulletList' || node.type === 'orderedList') return `\n${content}`;
  if (node.type === 'listItem') return `${node.attrs?.order ? `${node.attrs.order}.` : '-'} ${content.trim()}\n`; if (node.type === 'tableRow') return `| ${content.trim()} |\n`; if (node.type === 'tableCell' || node.type === 'tableHeader') return `${content.trim()} | `;
  if (node.type === 'paragraph' || node.type === 'doc') return `${content}\n`; return `${node.text ?? ''}${content}`;
}
