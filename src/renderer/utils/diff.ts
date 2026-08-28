/**
 * 逐行文本比对工具，用于展示 LLM 修改前后的差异（类似 git diff）
 */

export type DiffLineType = 'equal' | 'add' | 'remove';

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

/**
 * 按字段分组的比对内容
 */
export interface DiffSection {
  label: string;
  before: string;
  after: string;
}

export type DiffRow =
  | { kind: 'line'; type: DiffLineType; text: string }
  | { kind: 'skip'; count: number };

/**
 * 基于最长公共子序列（LCS）计算逐行差异
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.length > 0 ? before.split('\n') : [];
  const b = after.length > 0 ? after.split('\n') : [];
  const n = a.length;
  const m = b.length;

  if (n === 0 && m === 0) return [];
  if (n === 0) return b.map(text => ({ type: 'add' as const, text }));
  if (m === 0) return a.map(text => ({ type: 'remove' as const, text }));

  // 超大文本退化为整块替换，避免 O(n*m) 计算爆炸
  if (n * m > 1_000_000) {
    return [
      ...a.map<DiffLine>(text => ({ type: 'remove', text })),
      ...b.map<DiffLine>(text => ({ type: 'add', text })),
    ];
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ type: 'equal', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ type: 'remove', text: a[i] });
      i++;
    } else {
      lines.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) {
    lines.push({ type: 'remove', text: a[i] });
    i++;
  }
  while (j < m) {
    lines.push({ type: 'add', text: b[j] });
    j++;
  }
  return lines;
}

/**
 * 折叠长段未变化的行，只保留变更处上下文行（类似 git diff 的 context）
 */
export function collapseDiffRows(lines: DiffLine[], context = 3): DiffRow[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, index) => {
    if (line.type === 'equal') return;
    const start = Math.max(0, index - context);
    const end = Math.min(lines.length - 1, index + context);
    for (let k = start; k <= end; k++) {
      keep[k] = true;
    }
  });

  const rows: DiffRow[] = [];
  let index = 0;
  while (index < lines.length) {
    if (keep[index]) {
      rows.push({ kind: 'line', type: lines[index].type, text: lines[index].text });
      index++;
      continue;
    }
    let end = index;
    while (end < lines.length && !keep[end]) end++;
    rows.push({ kind: 'skip', count: end - index });
    index = end;
  }
  return rows;
}
