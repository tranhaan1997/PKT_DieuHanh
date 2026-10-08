/**
 * Kiểu dữ liệu cho cấu hình bài toán tính toán (theo Guideline VTNet).
 *
 * Mỗi bài toán = 1 `CalcDefinition` thuần dữ liệu (JSON-able) → sau này có thể
 * chuyển xuống DB để admin sửa mà không phải đổi code.
 */

/** Điều kiện theo giá trị select, VD { battType: 'VRLA' } hoặc { stationType: ['HUB', 'REGIONAL'] } (một trong) */
export type Condition = Record<string, string | string[]>;

export interface SelectOption {
  value: string;
  label: string;
  /** Biến được gán khi chọn option này (VD: loại phòng → Ka) */
  vars?: Record<string, number>;
  /** Giá trị mặc định cho dòng bảng khi chọn option này, theo key bảng (VD kích thước rack theo loại phòng) */
  tableDefaults?: Record<string, TableRow>;
  note?: string;
}

/** symbol: ký hiệu hiển thị dạng `X_{abc}` khi tự suy từ key không đúng (xem symbols.ts) */
export interface NumberInput {
  kind: 'number';
  key: string;
  label: string;
  symbol?: string;
  unit?: string;
  default?: number;
  min?: number;
  max?: number;
  help?: string;
  showIf?: Condition;
  group?: string;
  /** Cho phép lấy giá trị từ kết quả bài toán khác, VD Pac của bài Nhu cầu công suất tải */
  linkFrom?: { calc: string; key: string };
  /** Hiện giá trị của 1 công thức ngay dưới ô nhập, VD tra k_td tại T' */
  hintFrom?: { key: string; label: string };
}

export interface SelectInput {
  kind: 'select';
  key: string;
  label: string;
  options: SelectOption[];
  default: string;
  help?: string;
  showIf?: Condition;
  group?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  unit?: string;
  options?: { value: string; label: string }[];
  default?: string | number;
  /** độ rộng tương đối (flex) */
  flex?: number;
}

export type TableRow = Record<string, string | number>;

export interface TableInput {
  kind: 'table';
  key: string;
  label: string;
  columns: TableColumn[];
  defaultRows?: TableRow[];
  help?: string;
  showIf?: Condition;
  group?: string;
}

export type CalcInput = NumberInput | SelectInput | TableInput;

/** Công thức dạng biểu thức: dùng các biến input/param/formula trước đó */
export interface ExprFormula {
  kind: 'expr';
  key: string;
  label: string;
  symbol?: string;
  expr: string;
  unit?: string;
  decimals?: number;
  /** Kết quả chính → hiển thị nổi bật */
  primary?: boolean;
  /** Chỉ tính khi điều kiện đúng (cùng key có thể có nhiều công thức theo điều kiện) */
  when?: Condition;
}

/** Công thức tổng Σ trên bảng: Σ rowExpr với các dòng thỏa where */
export interface SumFormula {
  kind: 'sum';
  key: string;
  label: string;
  symbol?: string;
  table: string;
  rowExpr: string;
  where?: { column: string; equals: string };
  unit?: string;
  decimals?: number;
  primary?: boolean;
  when?: Condition;
}

export type CalcFormula = ExprFormula | SumFormula;

export interface CalcParam {
  key: string;
  label: string;
  symbol?: string;
  value: number;
  unit?: string;
}

/** Kiểm tra sau khi tính: expr ≠ 0 → hiện cảnh báo */
export interface CalcCheck {
  expr: string;
  message: string;
  when?: Condition;
}

export interface CalcDefinition {
  code: string;
  name: string;
  /** Mã mục trong Guideline (chỉ dùng nội bộ, không hiển thị) */
  section?: string;
  version: string;
  description?: string;
  /** Công thức gốc theo Guideline (hiển thị tham khảo) */
  reference?: string[];
  notes?: string[];
  inputs: CalcInput[];
  params?: CalcParam[];
  formulas: CalcFormula[];
  checks?: CalcCheck[];
}

export type InputValues = Record<string, number | string | TableRow[]>;

export interface StepResult {
  key: string;
  label: string;
  value: number;
  unit?: string;
  decimals: number;
  primary: boolean;
  /** Biểu thức gốc, VD "Seq / Ka * 1.5" */
  expr: string;
  /** Biểu thức đã thay số, VD "4.8 / 0.38 * 1.5" */
  substituted: string;
  /** Thiếu dữ liệu đầu vào → chưa tính được (không phải lỗi) */
  pending?: string;
  /** Công thức Σ: chi tiết từng dòng của bảng */
  terms?: { label: string; substituted: string; value: number }[];
  error?: string;
}

export interface CalcResult {
  steps: StepResult[];
  scope: Record<string, number>;
  errors: string[];
  warnings: string[];
}
