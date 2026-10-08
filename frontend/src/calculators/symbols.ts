import type { CalcDefinition } from './types';

/**
 * Ký hiệu toán học hiển thị.
 *
 * Quy ước trong chuỗi cấu hình: `X_{abc}` → X với chỉ số dưới "abc" (VD `P_{AC}` → P<sub>AC</sub>).
 * Tên biến trong công thức (VD `P_AC`, `k_DOD`) tự đổi thành ký hiệu: phần trước dấu `_` đầu tiên
 * là chữ chính, phần sau là chỉ số dưới. Biến cần hiển thị khác thì khai báo `symbol` trong cấu hình.
 */

const SPECIAL: Record<string, string> = {
  cosphi: 'cosφ',
  P_sum: 'P_{Σ}',
};

/** Ký hiệu hiển thị (dạng `X_{abc}`) của 1 biến trong bài toán */
export function symbolOf(def: CalcDefinition, key: string): string {
  const declared =
    def.inputs.find((i) => i.key === key && i.kind !== 'table' && 'symbol' in i && i.symbol)
    ?? def.params?.find((p) => p.key === key && p.symbol)
    ?? def.formulas.find((f) => f.key === key && f.symbol);
  if (declared && 'symbol' in declared && declared.symbol) return declared.symbol;
  if (Object.hasOwn(SPECIAL, key)) return SPECIAL[key];
  const i = key.indexOf('_');
  return i > 0 && i < key.length - 1 ? `${key.slice(0, i)}_{${key.slice(i + 1)}}` : key;
}

/** Đổi các tên biến trong biểu thức (đã prettyExpr) sang ký hiệu hiển thị */
export function exprToMath(def: CalcDefinition, expr: string): string {
  return expr.replace(/\b[A-Za-z][A-Za-z0-9_]*\b/g, (name) => symbolOf(def, name));
}

/** Bản chữ thường (bỏ định dạng chỉ số) — dùng cho placeholder, aria-label */
export function plainMath(text: string): string {
  return text.replace(/_\{([^}]*)\}/g, '$1');
}
