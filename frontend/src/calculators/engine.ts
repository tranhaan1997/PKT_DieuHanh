import type {
  CalcDefinition, CalcInput, CalcResult, Condition, InputValues, StepResult, TableInput, TableRow,
} from './types';
import { MissingVariableError, evaluate, formatNumber, prettyExpr, substitute } from './expression';

const toNum = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }
  return 0;
};

const isBlank = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '');

/** Điều kiện { selectKey: value } có thỏa với giá trị đang nhập không */
export function matches(cond: Condition | undefined, values: InputValues): boolean {
  return !cond || Object.entries(cond).every(([k, v]) =>
    Array.isArray(v) ? v.includes(values[k] as string) : values[k] === v);
}

export function visibleInputs(def: CalcDefinition, values: InputValues): CalcInput[] {
  return def.inputs.filter((i) => matches(i.showIf, values));
}

export function defaultValues(def: CalcDefinition): InputValues {
  const values: InputValues = {};
  for (const input of def.inputs) {
    if (input.kind === 'number') values[input.key] = input.default ?? '';
    else if (input.kind === 'select') values[input.key] = input.default;
    else values[input.key] = (input.defaultRows ?? []).map((r) => ({ ...r }));
  }
  return values;
}

export function emptyRow(table: TableInput, overrides: TableRow = {}): TableRow {
  const row: TableRow = {};
  for (const c of table.columns) row[c.key] = c.default ?? (c.type === 'number' ? 0 : '');
  return { ...row, ...overrides };
}

/** Mặc định cho dòng mới của bảng theo các lựa chọn select hiện tại (tableDefaults) */
export function rowOverrides(def: CalcDefinition, values: InputValues, tableKey: string): TableRow {
  const out: TableRow = {};
  for (const input of def.inputs) {
    if (input.kind !== 'select') continue;
    const opt = input.options.find((o) => o.value === values[input.key]);
    Object.assign(out, opt?.tableDefaults?.[tableKey] ?? {});
  }
  return out;
}

/**
 * Cập nhật 1 input. Với select có tableDefaults: dòng bảng còn đúng mặc định của lựa chọn cũ
 * (chưa sửa tay) được đổi sang mặc định của lựa chọn mới; dòng đã sửa tay giữ nguyên.
 */
export function applyInputChange(
  def: CalcDefinition, values: InputValues, key: string, value: InputValues[string],
): InputValues {
  const next: InputValues = { ...values, [key]: value };
  const input = def.inputs.find((i) => i.key === key);
  if (input?.kind !== 'select') return next;
  const oldOpt = input.options.find((o) => o.value === values[key]);
  const newOpt = input.options.find((o) => o.value === value);
  for (const [table, newDefaults] of Object.entries(newOpt?.tableDefaults ?? {})) {
    const oldDefaults = oldOpt?.tableDefaults?.[table];
    if (!oldDefaults) continue;
    const rows = (values[table] as TableRow[] | undefined) ?? [];
    next[table] = rows.map((r) =>
      Object.entries(oldDefaults).every(([k, v]) => String(r[k]).trim() !== '' && Number(r[k]) === Number(v))
        ? { ...r, ...newDefaults }
        : r,
    );
  }
  return next;
}

/** Tính toàn bộ bài toán theo thứ tự công thức trong cấu hình */
export function compute(def: CalcDefinition, values: InputValues): CalcResult {
  const scope: Record<string, number> = {};
  const errors: string[] = [];
  const warnings: string[] = [];
  const inputLabels: Record<string, string> = {};

  for (const p of def.params ?? []) scope[p.key] = p.value;

  for (const input of visibleInputs(def, values)) {
    inputLabels[input.key] = input.label;
    if (input.kind === 'number') {
      // Ô trống → không đưa vào scope; công thức dùng nó sẽ ở trạng thái "chờ nhập"
      if (isBlank(values[input.key])) continue;
      const n = toNum(values[input.key]);
      if (Number.isNaN(n)) { errors.push(`${input.label}: giá trị không hợp lệ`); continue; }
      if (input.min != null && n < input.min) errors.push(`${input.label} phải ≥ ${input.min}`);
      if (input.max != null && n > input.max) errors.push(`${input.label} phải ≤ ${input.max}`);
      scope[input.key] = n;
    } else if (input.kind === 'select') {
      const opt = input.options.find((o) => o.value === values[input.key]);
      Object.assign(scope, opt?.vars ?? {});
    }
  }

  const steps: StepResult[] = [];
  const pendingBy: Record<string, string> = {};
  for (const f of def.formulas) {
    if (!matches(f.when, values)) continue;
    const decimals = f.decimals ?? 2;
    const base = { key: f.key, label: f.label, unit: f.unit, decimals, primary: !!f.primary };
    const rawExpr = f.kind === 'expr' ? f.expr : f.rowExpr;
    try {
      if (f.kind === 'expr') {
        const value = evaluate(f.expr, scope);
        scope[f.key] = value;
        steps.push({ ...base, value, expr: prettyExpr(f.expr), substituted: prettyExpr(substitute(f.expr, scope)) });
      } else {
        const tableDef = def.inputs.find((i): i is TableInput => i.kind === 'table' && i.key === f.table);
        const rows = (values[f.table] as TableRow[] | undefined) ?? [];
        const numericCols = tableDef?.columns.filter((c) => c.type === 'number').map((c) => c.key) ?? [];
        const labelCol = tableDef?.columns.find((c) => c.type === 'text')?.key;
        const matched = rows.filter((r) => !f.where || r[f.where.column] === f.where.equals);

        let value = 0;
        const terms: NonNullable<StepResult['terms']> = [];
        matched.forEach((row) => {
          const rowScope = { ...scope };
          for (const k of numericCols) rowScope[k] = toNum(row[k]) || 0;
          const v = evaluate(f.rowExpr, rowScope);
          if (v === 0) return;
          value += v;
          const label = (labelCol && String(row[labelCol] ?? '').trim()) || `Dòng ${rows.indexOf(row) + 1}`;
          terms.push({ label, substituted: prettyExpr(substitute(f.rowExpr, rowScope)), value: v });
        });
        scope[f.key] = value;
        const cond = f.where ? ` (${f.where.column} = ${f.where.equals})` : '';
        steps.push({
          ...base,
          value,
          expr: `Σ ${prettyExpr(f.rowExpr)}${cond}`,
          substituted: terms.length ? terms.map((t) => formatNumber(t.value, 4, false)).join(' + ') : '0',
          terms,
        });
      }
    } catch (e) {
      // Biến thiếu là input chưa nhập, hoặc công thức trước đó cũng đang chờ → chờ nhập, không phải lỗi
      if (e instanceof MissingVariableError) {
        const pending = pendingBy[e.variable] ?? `Chờ nhập: ${inputLabels[e.variable] ?? e.variable}`;
        pendingBy[f.key] = pending;
        steps.push({ ...base, value: NaN, expr: prettyExpr(rawExpr), substituted: '', pending });
        continue;
      }
      const msg = e instanceof Error ? e.message : String(e);
      scope[f.key] = NaN;
      steps.push({ ...base, value: NaN, expr: prettyExpr(rawExpr), substituted: '', error: msg });
      errors.push(`${f.label}: ${msg}`);
    }
  }

  for (const c of def.checks ?? []) {
    if (!matches(c.when, values)) continue;
    try {
      if (evaluate(c.expr, scope)) warnings.push(c.message);
    } catch {
      // Chưa đủ dữ liệu để kiểm tra → bỏ qua
    }
  }

  return { steps, scope, errors, warnings };
}
