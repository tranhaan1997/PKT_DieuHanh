/**
 * Bộ phân tích & tính biểu thức số học an toàn (không dùng eval).
 *
 * Hỗ trợ: số, biến, + - * / ^, ngoặc, dấu âm, các hàm trong FUNCTIONS và
 * so sánh > < >= <= == != (trả về 1/0, dùng cho checks).
 * VD: "Seq / Ka * 1.5", "ceil(Sfl / 0.36)", "N != floor(N)"
 */

/** Biến chưa có giá trị (thường do người dùng chưa nhập) */
export class MissingVariableError extends Error {
  readonly variable: string;
  constructor(variable: string) {
    super(`Chưa có giá trị cho biến "${variable}"`);
    this.variable = variable;
  }
}

type Token =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string };

type Node =
  | { type: 'num'; value: number }
  | { type: 'var'; name: string }
  | { type: 'unary'; op: string; arg: Node }
  | { type: 'bin'; op: string; left: Node; right: Node }
  | { type: 'call'; name: string; args: Node[] };

/** Bỏ sai số dấu phẩy động (VD 512 / 51.2 = 10.000000000000002) trước khi làm tròn */
const snap = (x: number) => Math.round(x * 1e9) / 1e9;

const FUNCTIONS: Record<string, (...a: number[]) => number> = {
  ceil: (x) => Math.ceil(snap(x)),
  floor: (x) => Math.floor(snap(x)),
  abs: Math.abs,
  sqrt: Math.sqrt,
  min: Math.min,
  max: Math.max,
  round: (x, n = 0) => {
    const f = 10 ** n;
    return Math.round(x * f) / f;
  },
};

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^[0-9]*\.?[0-9]+(e[+-]?[0-9]+)?/i.exec(src.slice(i));
      if (!m) throw new Error(`Số không hợp lệ tại vị trí ${i}`);
      out.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      out.push({ t: 'id', v: m[0] });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['>=', '<=', '==', '!='].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/^(),<>'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    throw new Error(`Ký tự không hợp lệ "${c}"`);
  }
  return out;
}

/* Recursive descent: comparison → expr (cmp expr)? ; expr → term (('+'|'-') term)* ; term → power (('*'|'/') power)* ;
   power → unary ('^' power)? ; unary → ('-'|'+') unary | primary */
function parse(src: string): Node {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new Error(`Thiếu "${v}"`);
    pos++;
  };

  function comparison(): Node {
    const left = expr();
    const tok = peek();
    if (tok?.t === 'op' && ['>', '<', '>=', '<=', '==', '!='].includes(tok.v)) {
      pos++;
      return { type: 'bin', op: tok.v, left, right: expr() };
    }
    return left;
  }
  function expr(): Node {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[pos++] as { v: string }).v;
      left = { type: 'bin', op, left, right: term() };
    }
    return left;
  }
  function term(): Node {
    let left = power();
    while (isOp('*') || isOp('/')) {
      const op = (tokens[pos++] as { v: string }).v;
      left = { type: 'bin', op, left, right: power() };
    }
    return left;
  }
  function power(): Node {
    const base = unary();
    if (isOp('^')) { pos++; return { type: 'bin', op: '^', left: base, right: power() }; }
    return base;
  }
  function unary(): Node {
    if (isOp('-') || isOp('+')) {
      const op = (tokens[pos++] as { v: string }).v;
      return { type: 'unary', op, arg: unary() };
    }
    return primary();
  }
  function primary(): Node {
    const tok = peek();
    if (!tok) throw new Error('Biểu thức kết thúc đột ngột');
    if (tok.t === 'num') { pos++; return { type: 'num', value: tok.v }; }
    if (tok.t === 'id') {
      pos++;
      if (isOp('(')) {
        pos++;
        const args: Node[] = [];
        if (!isOp(')')) {
          args.push(comparison());
          while (isOp(',')) { pos++; args.push(comparison()); }
        }
        expect(')');
        if (!Object.hasOwn(FUNCTIONS, tok.v)) throw new Error(`Hàm không hỗ trợ: ${tok.v}`);
        return { type: 'call', name: tok.v, args };
      }
      return { type: 'var', name: tok.v };
    }
    if (isOp('(')) { pos++; const e = comparison(); expect(')'); return e; }
    throw new Error(`Không mong đợi "${tok.v}"`);
  }

  const node = comparison();
  if (pos < tokens.length) throw new Error(`Thừa ký tự "${(tokens[pos] as { v: unknown }).v}"`);
  return node;
}

const cache = new Map<string, Node>();
function compile(src: string): Node {
  let n = cache.get(src);
  if (!n) { n = parse(src); cache.set(src, n); }
  return n;
}

function evalNode(n: Node, scope: Record<string, number>): number {
  switch (n.type) {
    case 'num': return n.value;
    case 'var': {
      if (!Object.hasOwn(scope, n.name)) throw new MissingVariableError(n.name);
      return scope[n.name];
    }
    case 'unary': {
      const v = evalNode(n.arg, scope);
      return n.op === '-' ? -v : v;
    }
    case 'bin': {
      const a = evalNode(n.left, scope);
      const b = evalNode(n.right, scope);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/':
          if (b === 0) throw new Error('Chia cho 0');
          return a / b;
        case '^': return a ** b;
        case '>': return a > b ? 1 : 0;
        case '<': return a < b ? 1 : 0;
        case '>=': return a >= b ? 1 : 0;
        case '<=': return a <= b ? 1 : 0;
        case '==': return Math.abs(a - b) < 1e-9 ? 1 : 0;
        case '!=': return Math.abs(a - b) < 1e-9 ? 0 : 1;
      }
      throw new Error(`Toán tử không hỗ trợ: ${n.op}`);
    }
    case 'call': return FUNCTIONS[n.name](...n.args.map((a) => evalNode(a, scope)));
  }
}

export function evaluate(src: string, scope: Record<string, number>): number {
  return evalNode(compile(src), scope);
}

/** Danh sách biến mà biểu thức tham chiếu (bỏ qua tên hàm) */
export function variablesOf(src: string): string[] {
  const names = new Set<string>();
  const walk = (n: Node) => {
    if (n.type === 'var') names.add(n.name);
    else if (n.type === 'unary') walk(n.arg);
    else if (n.type === 'bin') { walk(n.left); walk(n.right); }
    else if (n.type === 'call') n.args.forEach(walk);
  };
  walk(compile(src));
  return [...names];
}

export function formatNumber(v: number, decimals = 2, grouping = true): string {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('vi-VN', { maximumFractionDigits: decimals, useGrouping: grouping });
}

/** Thay biến trong biểu thức bằng giá trị, VD "Seq / Ka" → "4,8 / 0,38" */
export function substitute(src: string, scope: Record<string, number>, decimals = 4): string {
  return src.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (name) =>
    Object.hasOwn(FUNCTIONS, name) || !Object.hasOwn(scope, name) ? name : formatNumber(scope[name], decimals, false),
  );
}

/** Hiển thị đẹp: * → ×, / → ÷, số thập phân dùng dấu phẩy như formatNumber (vi-VN) */
export function prettyExpr(src: string): string {
  return src
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/(\d)\.(\d)/g, '$1,$2')
    .replace(/\s+/g, ' ')
    .trim();
}
