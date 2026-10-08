import type { CalcDefinition } from './types';

/**
 * Cấu hình các bài toán định cỡ theo Guideline VTNet — Phần F.
 * Nguyên tắc F.1: kết quả là khối lượng cần (N-need), CHƯA bao gồm dự phòng.
 *
 * Đổi công thức/hệ số: chỉ sửa file này (sau này chuyển xuống DB).
 */

const LOAD_SOURCES = [
  { value: 'AC', label: 'AC' },
  { value: 'DC', label: 'DC' },
];

export const loadPower: CalcDefinition = {
  code: 'load-power',
  name: 'Nhu cầu công suất tải',
  // section: 'F.2',
  version: 'VTNet-F.2',
  description: 'Tổng công suất tải AC (P_{AC}) và DC (P_{DC}) của trạm',
  reference: [
    'P_{AC} = P_{load-ac-1} + P_{load-ac-2} + … + P_{load-ac-n}',
    'P_{DC} = P_{load-dc-1} + P_{load-dc-2} + … + P_{load-dc-n}',
  ],
  notes: [
    'P_{load-ac-n}: Công suất thiết bị dùng nguồn AC thứ n',
    'P_{load-dc-n}: Công suất thiết bị dùng nguồn DC thứ n',
  ],
  inputs: [
    {
      kind: 'table',
      key: 'loads',
      label: 'Danh sách thiết bị tải',
      help: 'Nhập công suất 1 thiết bị và số lượng; thiết bị giống nhau nhập 1 dòng.',
      columns: [
        { key: 'name', label: 'Thiết bị', type: 'text', flex: 3 },
        { key: 'source', label: 'Nguồn', type: 'select', options: LOAD_SOURCES, default: 'DC', flex: 1.2 },
        { key: 'power', label: 'Công suất', type: 'number', unit: 'W', flex: 1.6 },
        { key: 'qty', label: 'SL', type: 'number', default: 1, flex: 1 },
      ],
      defaultRows: [
        { name: '', source: 'DC', power: 0, qty: 1 },
        { name: '', source: 'AC', power: 0, qty: 1 },
      ],
    },
  ],
  formulas: [
    { kind: 'sum', key: 'Pac_W', label: 'Tổng công suất tải AC', symbol: 'P_{AC,W}', table: 'loads', rowExpr: 'power * qty', where: { column: 'source', equals: 'AC' }, unit: 'W', decimals: 0 },
    { kind: 'expr', key: 'Pac', label: 'Tổng công suất tải AC', symbol: 'P_{AC}', expr: 'Pac_W / 1000', unit: 'kW', decimals: 3, primary: true },
    { kind: 'sum', key: 'Pdc_W', label: 'Tổng công suất tải DC', symbol: 'P_{DC,W}', table: 'loads', rowExpr: 'power * qty', where: { column: 'source', equals: 'DC' }, unit: 'W', decimals: 0 },
    { kind: 'expr', key: 'Pdc', label: 'Tổng công suất tải DC', symbol: 'P_{DC}', expr: 'Pdc_W / 1000', unit: 'kW', decimals: 3, primary: true },
  ],
};

const VRLA = { battType: 'VRLA' };
const LITHIUM = { battType: 'LITHIUM' };

export const ups: CalcDefinition = {
  code: 'ups',
  name: 'Định cỡ hệ thống UPS',
  // section: 'F.3',
  version: 'VTNet-F.3',
  description: 'Số module UPS và số lượng ắc quy (VRLA / Lithium)',
  reference: [
    'N_{ups} = P_{AC} / P_{ratedUps}  (làm tròn lên)',
    'N_{1string} = V_{batt_ups} / V_{batt}',
    'VRLA:    N_{battups} = (P_{AC} / cosφ / k_{ef}) / (P_{1cell15} × 6)  (làm tròn lên)',
    'Lithium: N_{battups} = (P_{AC} / cosφ / k_{ef}) / P_{module15}  (làm tròn lên)',
    'N_{string} = N_{battups} / N_{1string}  (làm tròn lên)',
  ],
  notes: [
    'Áp dụng cho UPS dạng module, dùng chung dàn ắc quy: P_{AC} là tổng tải AC của cả hệ thống',
    'P_{ratedUps}: công suất định mức của 01 module UPS (kW)',
    'P_{1cell15} / P_{module15}: công suất xả trong 15 phút tại điện áp ngắt theo catalog nhà sản xuất (W)',
    'Hệ số 6 (VRLA): quy đổi 1 cell 2V sang 1 bình 12V (6 cell/bình); Lithium đã tính theo module hoàn chỉnh',
    'P_{AC} (kW) được nhân 1000 để cùng đơn vị W với công suất xả của ắc quy',
    'Bước 2 — số lượng UPS theo cấu hình dự phòng: chưa áp dụng (theo mục dự phòng trong Guideline)',
  ],
  inputs: [
    { kind: 'number', key: 'P_AC', label: 'Tổng công suất tải AC (P_{AC})', unit: 'kW', min: 0, linkFrom: { calc: 'load-power', key: 'Pac' } },
    { kind: 'number', key: 'P_ratedUps', label: 'Công suất định mức 1 module UPS (P_{ratedUps})', unit: 'kW', min: 0 },
    {
      kind: 'select',
      key: 'battType',
      label: 'Loại ắc quy',
      default: 'VRLA',
      options: [
        { value: 'VRLA', label: 'VRLA (axit chì kín khí)' },
        { value: 'LITHIUM', label: 'Lithium' },
      ],
    },
    { kind: 'number', key: 'V_batt_ups', label: 'Điện áp tổ ắc quy của UPS (V_{batt_ups})', unit: 'V', min: 0 },
    { kind: 'number', key: 'V_batt', label: 'Điện áp danh định 1 bình/module (V_{batt})', unit: 'V', min: 0, default: 12, help: 'VRLA thường 12V; Lithium theo catalog' },
    { kind: 'number', key: 'P_1cell15', label: 'Công suất xả 15 phút / cell (P_{1cell15})', unit: 'W', min: 0, showIf: VRLA },
    { kind: 'number', key: 'P_module15', label: 'Công suất xả 15 phút / module (P_{module15})', unit: 'W', min: 0, showIf: LITHIUM },
    { kind: 'number', key: 'k_ef', label: 'Hiệu suất chuyển đổi UPS (k_{ef})', min: 0, max: 1, default: 0.95 },
  ],
  params: [
    { key: 'cosphi', label: 'Hệ số công suất cosφ', value: 1 },
  ],
  formulas: [
    { kind: 'expr', key: 'N_ups', label: 'Số module UPS', expr: 'ceil(P_AC / P_ratedUps)', unit: 'module', decimals: 0, primary: true },
    { kind: 'expr', key: 'N_1string', label: 'Số bình/module trong 1 tổ', expr: 'V_batt_ups / V_batt', decimals: 2 },
    { kind: 'expr', key: 'P_need', label: 'Công suất ắc quy cần cấp', expr: 'P_AC * 1000 / cosphi / k_ef', unit: 'W', decimals: 1 },
    { kind: 'expr', key: 'N_battups', label: 'Số bình ắc quy theo công suất', expr: 'ceil(P_need / (P_1cell15 * 6))', unit: 'bình', decimals: 0, when: VRLA },
    { kind: 'expr', key: 'N_battups', label: 'Số module ắc quy theo công suất', expr: 'ceil(P_need / P_module15)', unit: 'module', decimals: 0, when: LITHIUM },
    { kind: 'expr', key: 'N_string', label: 'Số tổ ắc quy', expr: 'ceil(N_battups / N_1string)', unit: 'tổ', decimals: 0, primary: true },
    { kind: 'expr', key: 'N_batt_total', label: 'Tổng số bình thực tế', expr: 'N_string * N_1string', unit: 'bình', decimals: 0, primary: true, when: VRLA },
    { kind: 'expr', key: 'N_batt_total', label: 'Tổng số module thực tế', expr: 'N_string * N_1string', unit: 'module', decimals: 0, primary: true, when: LITHIUM },
  ],
  checks: [
    { expr: 'N_1string != round(N_1string)', message: 'Điện áp tổ ắc quy không chia hết cho điện áp 1 bình/module — kiểm tra lại V_{batt_ups} và V_{batt}' },
    { expr: 'V_batt != 12', message: 'Hệ số 6 trong công thức VRLA chỉ đúng với bình 12V (6 cell × 2V)', when: VRLA },
  ],
};

const ACCESS = { stationType: 'ACCESS' };
const HUB = { stationType: 'HUB' };
const BY_WH = { method: 'WH' };
const BY_AH = { method: 'AH' };
const RECT_A = { rectUnit: 'A' };
const RECT_W = { rectUnit: 'W' };

const G_COMMON = 'Thông tin chung';
const G_BATT = 'Ắc quy (F.4.1 / F.4.2)';
const G_DC = 'Tủ nguồn DC / Rectifier (F.4.3)';

export const dcRectifier: CalcDefinition = {
  code: 'dc-rectifier',
  name: 'Định cỡ hệ thống DC/Rectifier',
  // section: 'F.4',
  version: 'VTNet-F.4',
  description: 'Số tổ ắc quy (Wh / Ah), số tủ nguồn DC và số rectifier',
  reference: [
    'F.4.1: E_{calc} = (W_{DC} × T_{backup}) × k_{td} × k_{aging} × k_{margin} / (k_{temp} × k_{DOD})',
    'F.4.2: C_{calc} = (I_{DC} × T_{backup}) × k_{td} × k_{aging} × k_{margin} / (k_{temp} × k_{DOD})',
    "k_{td} tra catalogue tại T'_{backup} = T_{backup} / k_{DOD}",
    'N_{battery} = E_{calc} / E_{rated} − k_{round}  (Ah: C_{calc} / C_{rated} − k_{round})',
    'k_{round} = 0 nếu E_{calc} ≤ 1,15 × E_{rated}; k_{round} = 0,15 nếu E_{calc} > 1,15 × E_{rated}',
    'N_{DC} = (P_{DC} + k × P_{chargingBattDC}) / P_{ratedDC}  (làm tròn lên)',
    'N_{rect} = max( ⌈P_{DC} / P_{ratedRect}⌉ + 1 , ⌈(P_{DC} + k × P_{chargingBattDC}) / P_{ratedRect}⌉ )',
  ],
  notes: [
    'F.4.1 (Wh): áp dụng cho ắc quy LiB hoặc khi so sánh công nghệ ắc quy có điện áp khác nhau',
    'F.4.2 (Ah): áp dụng cho ắc quy chì, I_{DC} tính tại điện áp hoạt động trung bình của ắc quy',
    'E_{rated} / C_{rated}: năng lượng / dung lượng định mức của 1 tổ ắc quy',
    'Trạm truy nhập: N_{battery} làm tròn lên, tối thiểu 1 tổ; k = 1',
    'Trạm hội tụ, tổng trạm: N_{battery} làm tròn lên số chẵn, mỗi tủ DC tối thiểu 2 tổ; k = 0,5 (cấu hình 2N)',
    'Trạm hội tụ: N_{DC} là số tủ của 1 nhánh — phần nhân đôi 2N tính ở dự phòng',
    'N_{rect} đã gồm +1 rectifier dự phòng theo công thức Guideline',
    'P_{ratedRect} theo Guideline ghi đơn vị A → quy đổi W = dòng định mức × điện áp ra để cùng đơn vị với P_{DC}',
    'k_{temp}: tra Phụ lục 2 — Hệ số biến đổi dung lượng ắc quy theo nhiệt độ (tạm nhập tay)',
    'P_{chargingBattDC}: Guideline chưa nêu công thức — tạm nhập tay',
  ],
  inputs: [
    {
      kind: 'select', key: 'stationType', label: 'Loại trạm', default: 'ACCESS', group: G_COMMON,
      options: [
        { value: 'ACCESS', label: 'Trạm truy nhập', vars: { k: 1 } },
        { value: 'HUB', label: 'Trạm hội tụ / tổng trạm (2N)', vars: { k: 0.5 } },
      ],
    },
    { kind: 'number', key: 'P_DC', label: 'Tổng công suất tải DC (P_{DC} / W_{DC})', unit: 'W', min: 0, group: G_COMMON, linkFrom: { calc: 'load-power', key: 'Pdc_W' } },

    {
      kind: 'select', key: 'method', label: 'Cách tính ắc quy', default: 'WH', group: G_BATT,
      options: [
        { value: 'WH', label: 'Theo năng lượng Wh (LiB / so sánh công nghệ)' },
        { value: 'AH', label: 'Theo dung lượng Ah (ắc quy chì)' },
      ],
    },
    { kind: 'number', key: 'V_avg', label: 'Điện áp hoạt động trung bình của ắc quy', unit: 'V', min: 0, group: G_BATT, showIf: BY_AH, help: 'Dùng để tính I_{DC} = P_{DC} / V' },
    { kind: 'number', key: 'T_backup', label: 'Thời gian dự phòng mong muốn (T_{backup})', unit: 'h', min: 0, group: G_BATT },
    { kind: 'number', key: 'k_DOD', label: 'Hệ số xả sâu (k_{DOD})', min: 0, max: 1, group: G_BATT },
    { kind: 'number', key: 'k_td', label: 'Hệ số thời gian xả (k_{td})', min: 0, group: G_BATT, help: 'Tra catalogue ắc quy', hintFrom: { key: 'T_prime', label: "Tra k_{td} tại T'_{backup}" } },
    { kind: 'number', key: 'k_temp', label: 'Hệ số hiệu chỉnh nhiệt độ (k_{temp})', min: 0, default: 1, group: G_BATT, help: 'Tra Phụ lục 2' },
    { kind: 'number', key: 'E_rated', label: 'Năng lượng định mức 1 tổ (E_{rated})', unit: 'Wh', min: 0, group: G_BATT, showIf: BY_WH },
    { kind: 'number', key: 'C_rated', label: 'Dung lượng định mức 1 tổ (C_{rated})', unit: 'Ah', min: 0, group: G_BATT, showIf: BY_AH },

    { kind: 'number', key: 'P_ratedDC', label: 'Công suất định mức 1 tủ nguồn DC (P_{ratedDC})', unit: 'W', min: 0, group: G_DC },
    { kind: 'number', key: 'P_charging', label: 'Công suất nạp ắc quy (P_{chargingBattDC})', symbol: 'P_{chargingBattDC}', unit: 'W', min: 0, group: G_DC, help: 'Tạm nhập tay — Guideline chưa nêu công thức' },
    {
      kind: 'select', key: 'rectUnit', label: 'Định mức rectifier theo', default: 'A', group: G_DC,
      options: [
        { value: 'A', label: 'Dòng điện (A)' },
        { value: 'W', label: 'Công suất (W)' },
      ],
    },
    { kind: 'number', key: 'I_ratedRect', label: 'Dòng định mức 1 rectifier', unit: 'A', min: 0, group: G_DC, showIf: RECT_A },
    { kind: 'number', key: 'V_rect', label: 'Điện áp ra rectifier', unit: 'V', min: 0, group: G_DC, showIf: RECT_A, help: 'Để quy đổi A → W' },
    { kind: 'number', key: 'P_ratedRect_W', label: 'Công suất định mức 1 rectifier (P_{ratedRect})', symbol: 'P_{ratedRect}', unit: 'W', min: 0, group: G_DC, showIf: RECT_W },
  ],
  params: [
    { key: 'k_aging', label: 'Hệ số suy giảm tuổi thọ', value: 1.25 },
    { key: 'k_margin', label: 'Hệ số dự phòng khác', value: 1.05 },
  ],
  formulas: [
    { kind: 'expr', key: 'T_prime', label: "Thời gian tra k_{td}", symbol: "T'_{backup}", expr: 'T_backup / k_DOD', unit: 'h', decimals: 2 },

    { kind: 'expr', key: 'E_calc', label: 'Năng lượng ắc quy cần', expr: 'P_DC * T_backup * k_td * k_aging * k_margin / (k_temp * k_DOD)', unit: 'Wh', decimals: 1, when: BY_WH },
    { kind: 'expr', key: 'ratio', label: 'Tỷ số E_{calc} / E_{rated}', expr: 'E_calc / E_rated', decimals: 3, when: BY_WH },
    { kind: 'expr', key: 'I_DC', label: 'Dòng tải DC (I_{DC})', expr: 'P_DC / V_avg', unit: 'A', decimals: 2, when: BY_AH },
    { kind: 'expr', key: 'C_calc', label: 'Dung lượng ắc quy cần (C_{calc})', expr: 'I_DC * T_backup * k_td * k_aging * k_margin / (k_temp * k_DOD)', unit: 'Ah', decimals: 1, when: BY_AH },
    { kind: 'expr', key: 'ratio', label: 'Tỷ số C_{calc} / C_{rated}', expr: 'C_calc / C_rated', decimals: 3, when: BY_AH },

    { kind: 'expr', key: 'k_round', label: 'Hệ số vượt', expr: '0.15 * (ratio > 1.15)', decimals: 2 },
    { kind: 'expr', key: 'N_raw', label: 'Số tổ trước làm tròn', expr: 'ratio - k_round', decimals: 3 },
    { kind: 'expr', key: 'N_battery', label: 'Số tổ ắc quy', expr: 'max(ceil(N_raw), 1)', unit: 'tổ', decimals: 0, primary: true, when: ACCESS },
    { kind: 'expr', key: 'N_battery', label: 'Số tổ ắc quy (làm tròn chẵn)', expr: 'max(2 * ceil(N_raw / 2), 2)', unit: 'tổ', decimals: 0, primary: true, when: HUB },

    { kind: 'expr', key: 'P_total', label: 'Tải + nạp ắc quy', expr: 'P_DC + k * P_charging', unit: 'W', decimals: 1 },
    { kind: 'expr', key: 'N_DC', label: 'Số tủ nguồn DC', expr: 'ceil(P_total / P_ratedDC)', unit: 'tủ', decimals: 0, primary: true },
    { kind: 'expr', key: 'P_ratedRect', label: 'Công suất 1 rectifier', expr: 'I_ratedRect * V_rect', unit: 'W', decimals: 1, when: RECT_A },
    { kind: 'expr', key: 'P_ratedRect', label: 'Công suất 1 rectifier', expr: 'P_ratedRect_W', unit: 'W', decimals: 1, when: RECT_W },
    { kind: 'expr', key: 'N_rect', label: 'Số rectifier', expr: 'max(ceil(P_DC / P_ratedRect) + 1, ceil(P_total / P_ratedRect))', unit: 'rectifier', decimals: 0, primary: true },
  ],
  checks: [
    { expr: 'N_battery < 2 * N_DC', message: 'Trạm hội tụ: mỗi tủ DC cần tối thiểu 2 tổ ắc quy — cân nhắc chọn E_{rated}/C_{rated} nhỏ hơn để tăng số tổ', when: HUB },
  ],
};

const COOL_ACCESS = { stationType: 'ACCESS' };
const COOL_HUB = { stationType: ['HUB', 'REGIONAL'] };

const G_HEAT = 'Tải nhiệt thiết bị';
const G_HUB_HEAT = 'Tải nhiệt bổ sung (F.5.2)';
const G_AC = 'Điều hòa';

export const cooling: CalcDefinition = {
  code: 'cooling',
  name: 'Định cỡ hệ thống làm mát',
  // section: 'F.5',
  version: 'VTNet-F.5',
  description: 'Tổng công suất lạnh P_{cool} và số lượng điều hòa',
  reference: [
    'F.5.1 (truy nhập): P_{cool} = (P_{DC} + P_{AC}) × k_{insure};  k_{insure} = 1,3',
    'F.5.1: N_{cooling} = P_{cool} / P_{ratedCooling};  P_{ratedCooling} (W) = P_{ratedCooling} (BTU/h) × 0,293',
    'F.5.2 (hội tụ, tổng trạm, DC): P_{cool} = (P1 + P2 + P3 + P4 + P5) × k_{insure};  k_{insure} = 1,15',
    'P1 = P_{DC} + P_{AC}',
    'P2 = 0,04 × (P_{ratedDCsysN} + P_{ratedACsysN}) + 0,05 × P1',
    'P3 = 0,01 × (P_{ratedDCsysN} + P_{ratedACsysN}) + 0,02 × P1',
    'P4 = 21,53 × S_{fl};  P5 = 100 (W) × k (người)',
    'F.5.2: N_{cooling} = P_{cool} / ((1 − Tol) × P_{ratedCooling})',
  ],
  notes: [
    'P_{DC} + P_{AC}: tổng công suất nhiệt tỏa ra của phần thiết bị tỏa nhiệt trong không gian nhà trạm cần làm mát',
    'k_{insure}: hệ số dự phòng công suất lạnh cho truyền nhiệt qua tường, trần, sàn… (bao che) và rò lọt không khí qua cửa',
    'N_{cooling}: số lượng điều hòa tính với cấu hình N, làm tròn lên',
    'F.5.2: P_{cool} là Net Sensible Cooling; P_{ratedCooling} là công suất Net Sensible Cooling định mức của 01 điều hòa ở điều kiện Outdoor',
    'P2: nhiệt tỏa ra của thiết bị phụ trợ nguồn DC và UPS; P3: nhiệt tỏa ra của hệ thống phân phối nguồn AC',
    'P_{ratedDCsysN} / P_{ratedACsysN}: công suất định mức hệ thống DC / AC cấu hình N',
    'P4: hệ số 21,53 W/m² theo công thức; trường hợp dùng hệ số 10–15 W/m² theo TIA 942-C thì sửa ô hệ số chiếu sáng',
    'Số người làm việc thường trong phòng máy: trạm hội tụ, tổng trạm k = 3; tổng trạm khu vực/DC k = 5',
    'Tol: dung sai công suất theo tiêu chuẩn của nhà sản xuất',
  ],
  inputs: [
    {
      kind: 'select', key: 'stationType', label: 'Loại trạm', default: 'ACCESS',
      options: [
        { value: 'ACCESS', label: 'Trạm truy nhập (F.5.1 — điều hòa dân dụng)', vars: { k_insure: 1.3 } },
        { value: 'HUB', label: 'Trạm hội tụ / tổng trạm (F.5.2)', vars: { k_insure: 1.15, k: 3 } },
        { value: 'REGIONAL', label: 'Tổng trạm khu vực / DC (F.5.2)', vars: { k_insure: 1.15, k: 5 } },
      ],
    },
    { kind: 'number', key: 'P_DC', label: 'Công suất nhiệt thiết bị DC (P_{DC})', unit: 'W', min: 0, group: G_HEAT, help: 'Thiết bị tỏa nhiệt trong không gian nhà trạm cần làm mát' },
    { kind: 'number', key: 'P_AC', label: 'Công suất nhiệt thiết bị AC (P_{AC})', unit: 'W', min: 0, group: G_HEAT, help: 'Thiết bị tỏa nhiệt trong không gian nhà trạm cần làm mát' },

    { kind: 'number', key: 'P_DCsysN', label: 'Công suất định mức hệ thống DC cấu hình N (P_{ratedDCsysN})', symbol: 'P_{ratedDCsysN}', unit: 'W', min: 0, group: G_HUB_HEAT, showIf: COOL_HUB },
    { kind: 'number', key: 'P_ACsysN', label: 'Công suất định mức hệ thống AC cấu hình N (P_{ratedACsysN})', symbol: 'P_{ratedACsysN}', unit: 'W', min: 0, group: G_HUB_HEAT, showIf: COOL_HUB },
    { kind: 'number', key: 'S_fl', label: 'Diện tích phòng máy (S_{fl})', unit: 'm²', min: 0, group: G_HUB_HEAT, showIf: COOL_HUB },
    { kind: 'number', key: 'k_light', label: 'Hệ số nhiệt chiếu sáng', unit: 'W/m²', min: 0, default: 21.53, group: G_HUB_HEAT, showIf: COOL_HUB, help: 'Theo công thức 21,53; TIA 942-C: 10–15' },

    { kind: 'number', key: 'Q_btu', label: 'Công suất lạnh định mức 1 điều hòa (P_{ratedCooling})', symbol: 'P_{ratedCooling,BTU}', unit: 'BTU/h', min: 0, group: G_AC, showIf: COOL_ACCESS, help: 'VD 9000 / 12000 / 18000 / 24000' },
    { kind: 'number', key: 'P_ratedNSC', label: 'Công suất Net Sensible Cooling định mức 1 điều hòa (P_{ratedCooling})', symbol: 'P_{ratedCooling}', unit: 'W', min: 0, group: G_AC, showIf: COOL_HUB },
    { kind: 'number', key: 'Tol', label: 'Dung sai công suất (Tol)', unit: '%', min: 0, max: 100, group: G_AC, showIf: COOL_HUB, help: 'Theo tiêu chuẩn của nhà sản xuất' },
  ],
  formulas: [
    // F.5.1 — trạm truy nhập
    { kind: 'expr', key: 'P_cool', label: 'Tổng công suất lạnh', expr: '(P_DC + P_AC) * k_insure', unit: 'W', decimals: 1, primary: true, when: COOL_ACCESS },
    { kind: 'expr', key: 'P_ratedCooling', label: 'Công suất lạnh 1 điều hòa', expr: 'Q_btu * 0.293', unit: 'W', decimals: 1, when: COOL_ACCESS },
    { kind: 'expr', key: 'N_cooling', label: 'Số lượng điều hòa', expr: 'ceil(P_cool / P_ratedCooling)', unit: 'máy', decimals: 0, primary: true, when: COOL_ACCESS },

    // F.5.2 — trạm hội tụ, tổng trạm, DC
    { kind: 'expr', key: 'P1', label: 'P1 — nhiệt tỏa của thiết bị', expr: 'P_DC + P_AC', unit: 'W', decimals: 1, when: COOL_HUB },
    { kind: 'expr', key: 'P2', label: 'P2 — thiết bị phụ trợ nguồn DC và UPS', expr: '0.04 * (P_DCsysN + P_ACsysN) + 0.05 * P1', unit: 'W', decimals: 1, when: COOL_HUB },
    { kind: 'expr', key: 'P3', label: 'P3 — hệ thống phân phối nguồn AC', expr: '0.01 * (P_DCsysN + P_ACsysN) + 0.02 * P1', unit: 'W', decimals: 1, when: COOL_HUB },
    { kind: 'expr', key: 'P4', label: 'P4 — chiếu sáng', expr: 'k_light * S_fl', unit: 'W', decimals: 1, when: COOL_HUB },
    { kind: 'expr', key: 'P5', label: 'P5 — người làm việc', expr: '100 * k', unit: 'W', decimals: 1, when: COOL_HUB },
    { kind: 'expr', key: 'P_cool', label: 'Tổng công suất lạnh (P_{cool} — Net Sensible)', expr: '(P1 + P2 + P3 + P4 + P5) * k_insure', unit: 'W', decimals: 1, primary: true, when: COOL_HUB },
    { kind: 'expr', key: 'P_eff', label: 'Công suất hiệu dụng 1 điều hòa', expr: '(1 - Tol / 100) * P_ratedNSC', unit: 'W', decimals: 1, when: COOL_HUB },
    { kind: 'expr', key: 'N_cooling', label: 'Số lượng điều hòa', expr: 'ceil(P_cool / P_eff)', unit: 'máy', decimals: 0, primary: true, when: COOL_HUB },
  ],
};

const PW_ACCESS = { stationType: 'ACCESS' };
const PW_SEPARATE = { stationType: 'OTHER', domestic: 'SEPARATE' };
const PW_SHARED = { stationType: 'OTHER', domestic: 'SHARED' };
const HAS_UPS = { hasUps: 'YES' };
const NO_UPS = { hasUps: 'NO' };

const G_COOL = 'Hệ thống làm mát';
const G_UPS = 'Nhánh AC qua UPS';
const G_DCB = 'Nhánh DC';

export const totalPower: CalcDefinition = {
  code: 'total-power',
  name: 'Tổng nhu cầu công suất tiêu thụ',
  // section: 'F.6',
  version: 'VTNet-F.6',
  description: 'Tổng công suất tiêu thụ P_{Σ} của trạm (kW)',
  reference: [
    'P_{Σ} (kW) = P_{e_cool} + (P_{AC} + P_{chargingBattUps}) / K_{ac-ac} + (P_{DC} + P_{chargingBattDC}) / K_{ac-dc} + P_{bl}',
  ],
  notes: [
    'P_{e_cool} (kW): công suất tiêu thụ (điện) của hệ thống lạnh tại điều kiện nhiệt độ tính toán tương ứng',
    'P_{chargingBattUps} / P_{chargingBattDC}: công suất nạp ắc quy của hệ thống UPS / DC',
    'K_{ac-ac}: hiệu suất chuyển đổi năng lượng của HT UPS; K_{ac-dc}: hiệu suất chuyển đổi năng lượng của HT DC',
    'P_{bl} (kW): công suất tải sinh hoạt tòa nhà theo nhu cầu thực tế — chỉ áp dụng khi không thể tách riêng nguồn phòng máy và nguồn sinh hoạt',
    'Trạm truy nhập: P_{bl} = 0',
    'Trạm không có UPS: nhánh AC chỉ gồm P_{AC} (không có nạp ắc quy UPS, không qua hiệu suất UPS)',
  ],
  inputs: [
    {
      kind: 'select', key: 'stationType', label: 'Loại trạm', default: 'ACCESS',
      options: [
        { value: 'ACCESS', label: 'Trạm truy nhập (P_{bl} = 0)' },
        { value: 'OTHER', label: 'Trạm hội tụ / tổng trạm / DC' },
      ],
    },
    {
      kind: 'select', key: 'domestic', label: 'Nguồn sinh hoạt', default: 'SHARED', showIf: { stationType: 'OTHER' },
      options: [
        { value: 'SHARED', label: 'Không tách riêng được với nguồn phòng máy' },
        { value: 'SEPARATE', label: 'Đã tách riêng (P_{bl} = 0)' },
      ],
    },
    { kind: 'number', key: 'P_bl', label: 'Công suất tải sinh hoạt tòa nhà (P_{bl})', unit: 'kW', min: 0, showIf: { stationType: 'OTHER', domestic: 'SHARED' }, help: 'Theo nhu cầu thực tế' },

    { kind: 'number', key: 'P_e_cool', label: 'Công suất điện tiêu thụ của hệ thống lạnh (P_{e_cool})', unit: 'kW', min: 0, group: G_COOL, help: 'Công suất ĐIỆN theo catalogue, không phải công suất lạnh' },

    {
      kind: 'select', key: 'hasUps', label: 'Có hệ thống UPS', default: 'YES', group: G_UPS,
      options: [
        { value: 'YES', label: 'Có' },
        { value: 'NO', label: 'Không' },
      ],
    },
    { kind: 'number', key: 'P_AC', label: 'Công suất tải AC (P_{AC})', unit: 'kW', min: 0, group: G_UPS, help: 'Không gồm hệ thống lạnh (đã tính ở P_{e_cool})' },
    { kind: 'number', key: 'P_chg_ups', label: 'Công suất nạp ắc quy UPS (P_{chargingBattUps})', symbol: 'P_{chargingBattUps}', unit: 'kW', min: 0, group: G_UPS, showIf: HAS_UPS },
    { kind: 'number', key: 'K_acac', label: 'Hiệu suất chuyển đổi HT UPS (K_{ac-ac})', symbol: 'K_{ac-ac}', min: 0, max: 1, default: 0.95, group: G_UPS, showIf: HAS_UPS },

    { kind: 'number', key: 'P_DC', label: 'Công suất tải DC (P_{DC})', unit: 'kW', min: 0, group: G_DCB },
    { kind: 'number', key: 'P_chg_dc', label: 'Công suất nạp ắc quy DC (P_{chargingBattDC})', symbol: 'P_{chargingBattDC}', unit: 'kW', min: 0, group: G_DCB },
    { kind: 'number', key: 'K_acdc', label: 'Hiệu suất chuyển đổi HT DC (K_{ac-dc})', symbol: 'K_{ac-dc}', min: 0, max: 1, group: G_DCB, help: 'Theo catalogue hệ thống DC/rectifier' },
  ],
  formulas: [
    { kind: 'expr', key: 'B_ups', label: 'Nhánh AC qua UPS', expr: '(P_AC + P_chg_ups) / K_acac', unit: 'kW', decimals: 3, when: HAS_UPS },
    { kind: 'expr', key: 'B_ups', label: 'Nhánh AC (không có UPS)', expr: 'P_AC', unit: 'kW', decimals: 3, when: NO_UPS },
    { kind: 'expr', key: 'B_dc', label: 'Nhánh DC', expr: '(P_DC + P_chg_dc) / K_acdc', unit: 'kW', decimals: 3 },
    { kind: 'expr', key: 'P_bl_used', label: 'Tải sinh hoạt', symbol: 'P_{bl}', expr: '0', unit: 'kW', decimals: 3, when: PW_ACCESS },
    { kind: 'expr', key: 'P_bl_used', label: 'Tải sinh hoạt (P_{bl} — đã tách riêng)', symbol: 'P_{bl}', expr: '0', unit: 'kW', decimals: 3, when: PW_SEPARATE },
    { kind: 'expr', key: 'P_bl_used', label: 'Tải sinh hoạt', symbol: 'P_{bl}', expr: 'P_bl', unit: 'kW', decimals: 3, when: PW_SHARED },
    { kind: 'expr', key: 'P_total', label: 'Tổng công suất tiêu thụ', symbol: 'P_{Σ}', expr: 'P_e_cool + B_ups + B_dc + P_bl_used', unit: 'kW', decimals: 3, primary: true },
  ],
};

export const transformer: CalcDefinition = {
  code: 'transformer',
  name: 'Định cỡ máy biến áp',
  // section: 'F.7',
  version: 'VTNet-F.7',
  description: 'Công suất định mức tối thiểu của máy biến áp (kVA)',
  reference: ['S_{đm} (kVA) ≥ P_{Σ} / (cosφ × K_{hc})'],
  notes: [
    'S_{đm}: công suất định mức máy biến áp — chọn frame tuân theo TCVN 6306 hoặc IEC 60076, không nhỏ hơn giá trị tối thiểu',
    'P_{Σ} (kW): tổng công suất lớn nhất của công trình trong suốt vòng đời dự án',
    'cosφ: MBA cho hệ thống IT cosφ = 1; MBA cho hệ thống MEC cosφ = 0,95',
    'Trường hợp khác (VD MBA cấp chung IT và MEC): Guideline không quy định — nhập cosφ theo thực tế',
    'K_{hc}: hệ số hiệu chỉnh suy giảm công suất MBA theo nhiệt độ môi trường khác 20 °C',
    'MBA dầu K_{hc} = 1; MBA khô K_{hc} = 0,94 (30 °C), K_{hc} = 0,9 (35 °C)',
  ],
  inputs: [
    { kind: 'number', key: 'P_sum', label: 'Tổng công suất lớn nhất trong vòng đời dự án (P_{Σ})', unit: 'kW', min: 0 },
    {
      kind: 'select', key: 'system', label: 'MBA cấp cho hệ thống', default: 'IT',
      options: [
        { value: 'IT', label: 'Hệ thống IT', vars: { cosphi: 1 } },
        { value: 'MEC', label: 'Hệ thống MEC (cơ điện)', vars: { cosphi: 0.95 } },
        { value: 'OTHER', label: 'Khác — nhập cosφ' },
      ],
    },
    { kind: 'number', key: 'cosphi', label: 'Hệ số công suất (cosφ)', min: 0, max: 1, showIf: { system: 'OTHER' }, help: 'VD 0,95 khi cấp chung IT và MEC' },
    {
      kind: 'select', key: 'xfmrType', label: 'Loại máy biến áp', default: 'OIL',
      options: [
        { value: 'OIL', label: 'MBA dầu', vars: { Khc: 1 } },
        { value: 'DRY30', label: 'MBA khô — môi trường 30 °C', vars: { Khc: 0.94 } },
        { value: 'DRY35', label: 'MBA khô — môi trường 35 °C', vars: { Khc: 0.9 } },
        { value: 'OTHER', label: 'Khác — nhập K_{hc}' },
      ],
    },
    { kind: 'number', key: 'Khc', label: 'Hệ số hiệu chỉnh nhiệt độ (K_{hc})', symbol: 'K_{hc}', min: 0, max: 1, showIf: { xfmrType: 'OTHER' }, help: 'Theo catalogue MBA tại nhiệt độ môi trường làm việc' },
  ],
  formulas: [
    { kind: 'expr', key: 'S_min', label: 'Công suất định mức MBA tối thiểu', symbol: 'S_{đm}', expr: 'P_sum / (cosphi * Khc)', unit: 'kVA', decimals: 2, primary: true },
  ],
};

export const generator: CalcDefinition = {
  code: 'generator',
  name: 'Định cỡ hệ thống MPĐ',
  // section: 'F.8',
  version: 'VTNet-F.8',
  description: 'Công suất MPĐ tối thiểu và số lượng máy phát điện',
  reference: ['N_{gen} = P_{Σ} × k_{ft} / (P_{rated} × cosφ × K_{h})  (làm tròn lên)'],
  notes: [
    'P_{Σ} (kW): tổng công suất lớn',
    'k_{ft}: hệ số dự phòng để đảm bảo khả năng lắp đặt thêm thiết bị trong tương lai, hạn chế dồn dịch MPĐ',
    'Tổng trạm khu vực/DC: tổng công suất tính theo hết vòng đời dự án nên k_{ft} = 1',
    'Trạm truy nhập, trạm hội tụ: mua mới hoặc dồn dịch đến vị trí mới k_{ft} = 1,25; đang sử dụng k_{ft} = 1',
    'cosφ: máy 1 pha cosφ = 1; máy 3 pha cosφ = 0,8',
    'K_{h}: hệ số suy giảm công suất MPĐ theo độ cao (tra catalogue MPĐ)',
    'P_{rated}: công suất định mức thiết kế của MPĐ (kVA)',
    'Công suất MPĐ tối thiểu nếu dùng 1 máy = P_{Σ} × k_{ft} / (cosφ × K_{h}) — suy ra từ công thức với N_{gen} = 1',
  ],
  inputs: [
    { kind: 'number', key: 'P_sum', label: 'Tổng công suất (P_{Σ})', unit: 'kW', min: 0 },
    {
      kind: 'select', key: 'genCase', label: 'Trường hợp', default: 'ACCESS_NEW',
      options: [
        { value: 'ACCESS_NEW', label: 'Truy nhập / hội tụ — mua mới hoặc dồn dịch', vars: { k_ft: 1.25 } },
        { value: 'ACCESS_INUSE', label: 'Truy nhập / hội tụ — đang sử dụng', vars: { k_ft: 1 } },
        { value: 'REGIONAL', label: 'Tổng trạm khu vực / DC', vars: { k_ft: 1 } },
      ],
    },
    {
      kind: 'select', key: 'phase', label: 'Loại máy', default: 'P3',
      options: [
        { value: 'P1', label: 'Máy 1 pha', vars: { cosphi: 1 } },
        { value: 'P3', label: 'Máy 3 pha', vars: { cosphi: 0.8 } },
      ],
    },
    { kind: 'number', key: 'K_h', label: 'Hệ số suy giảm công suất theo độ cao (K_{h})', min: 0, max: 1, default: 1, help: 'Tra catalogue MPĐ theo độ cao lắp đặt; = 1 nếu không suy giảm' },
    { kind: 'number', key: 'P_rated', label: 'Công suất định mức 1 MPĐ (P_{rated})', unit: 'kVA', min: 0, help: 'Nhập theo kVA — để trống nếu chưa chọn máy' },
  ],
  formulas: [
    { kind: 'expr', key: 'P_need', label: 'Công suất yêu cầu (P_{Σ} × k_{ft})', expr: 'P_sum * k_ft', unit: 'kW', decimals: 2 },
    { kind: 'expr', key: 'S_min', label: 'Công suất MPĐ tối thiểu nếu dùng 1 máy', expr: 'P_need / (cosphi * K_h)', unit: 'kVA', decimals: 2, primary: true },
    { kind: 'expr', key: 'P_avail', label: 'Công suất khả dụng 1 máy', expr: 'P_rated * cosphi * K_h', unit: 'kW', decimals: 2 },
    { kind: 'expr', key: 'N_gen', label: 'Số lượng MPĐ', expr: 'ceil(P_need / P_avail)', unit: 'máy', decimals: 0, primary: true },
  ],
};

const RACK_TELECOM = { length: 800, width: 600 };
const RACK_IT = { length: 1100, width: 600 };
const SEQ_TABLE = { seqMode: 'TABLE' };
const SEQ_DIRECT = { seqMode: 'DIRECT' };

export const raisedFloor: CalcDefinition = {
  code: 'raised-floor',
  name: 'Hệ thống sàn nâng',
  // section: 'F.9',
  version: 'VTNet-F.9',
  description: 'Diện tích phòng máy tính toán (S_{fl})',
  reference: ['S_{fl} = (S_{eq} / k_{a}) × 1,5  (m²)'],
  notes: [
    'S_{fl}: diện tích phòng máy tính toán',
    'k_{a} = 0,38: phòng máy Telecom bố trí thiết bị điển hình rack 600mm × 800mm theo quy tắc 7 tấm (tấm 600mm × 600mm)',
    'k_{a} = 0,45: phòng máy IT bố trí thiết bị điển hình rack 600mm × 1100mm theo quy tắc 8 tấm (tấm 600mm × 600mm)',
    'Hệ số 1,5: không gian tổng thể gồm hành lang đi lại, hành lang lắp đặt dàn lạnh trong phòng máy',
    'S_{eq} (m²): tổng diện tích cần dùng của các thiết bị BSS, Core, VAS, truyền dẫn, IP (theo số liệu đầu vào)',
    'Đổi loại phòng: các dòng còn kích thước rack điển hình sẽ tự đổi theo loại phòng mới; dòng đã sửa kích thước giữ nguyên',
  ],
  inputs: [
    {
      kind: 'select',
      key: 'roomType',
      label: 'Loại phòng máy',
      default: 'TELECOM',
      options: [
        { value: 'TELECOM', label: 'Telecom (rack 600×800, 7 tấm)', vars: { k_a: 0.38 }, tableDefaults: { equipments: RACK_TELECOM } },
        { value: 'IT', label: 'IT (rack 600×1100, 8 tấm)', vars: { k_a: 0.45 }, tableDefaults: { equipments: RACK_IT } },
      ],
    },
    {
      kind: 'select',
      key: 'seqMode',
      label: 'Cách nhập S_{eq}',
      default: 'TABLE',
      options: [
        { value: 'TABLE', label: 'Theo bảng thiết bị (kích thước × số lượng)' },
        { value: 'DIRECT', label: 'Nhập tổng S_{eq} (m²)' },
      ],
    },
    { kind: 'number', key: 'Seq_in', label: 'Tổng diện tích thiết bị (S_{eq})', symbol: 'S_{eq}', unit: 'm²', min: 0, showIf: SEQ_DIRECT, help: 'Theo số liệu đầu vào' },
    {
      kind: 'table',
      key: 'equipments',
      label: 'Thiết bị đặt trong phòng (S_{eq})',
      help: 'Kích thước chiếm sàn của 1 rack/thiết bị (mm) × số lượng.',
      showIf: SEQ_TABLE,
      columns: [
        { key: 'group', label: 'Nhóm thiết bị', type: 'text', flex: 2.4 },
        { key: 'length', label: 'Sâu', type: 'number', unit: 'mm', default: 800, flex: 1.4 },
        { key: 'width', label: 'Rộng', type: 'number', unit: 'mm', default: 600, flex: 1.4 },
        { key: 'qty', label: 'SL', type: 'number', default: 1, flex: 1 },
      ],
      defaultRows: ['BSS', 'Core', 'VAS', 'Truyền dẫn', 'IP'].map((group) => ({ group, ...RACK_TELECOM, qty: 0 })),
    },
  ],
  formulas: [
    { kind: 'sum', key: 'Seq', label: 'Tổng diện tích thiết bị', symbol: 'S_{eq}', table: 'equipments', rowExpr: 'length * width / 1000000 * qty', unit: 'm²', decimals: 2, when: SEQ_TABLE },
    { kind: 'expr', key: 'Seq', label: 'Tổng diện tích thiết bị', symbol: 'S_{eq}', expr: 'Seq_in', unit: 'm²', decimals: 2, when: SEQ_DIRECT },
    { kind: 'expr', key: 'Sfl', label: 'Diện tích phòng máy tính toán', symbol: 'S_{fl}', expr: 'Seq / k_a * 1.5', unit: 'm²', decimals: 2, primary: true },
  ],
};

export const CALCULATORS: CalcDefinition[] = [loadPower, ups, dcRectifier, cooling, totalPower, transformer, generator, raisedFloor];
