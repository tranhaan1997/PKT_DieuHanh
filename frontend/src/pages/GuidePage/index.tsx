import {
  Box, Typography, Chip, Accordion, AccordionSummary, AccordionDetails,
  Table, TableHead, TableBody, TableRow, TableCell, useMediaQuery, useTheme,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  CellTower, Build, CalendarMonth, Assignment, ListAltOutlined, ManageSearch,
  Dashboard, CloudSyncOutlined, GroupsOutlined, ArrowForward, ArrowDownward,
  EngineeringOutlined, SupervisorAccountOutlined, AdminPanelSettingsOutlined,
  AssessmentOutlined, ExpandMoreOutlined,
} from '@mui/icons-material';
import PageHeader from '../../components/ui/PageHeader';
import { palette, status } from '../../theme/tokens';

const ROLE_TONE: Record<string, { bg: string; fg: string }> = {
  ADMIN: { bg: `${status.error.solid}12`, fg: status.error.solid },
  SUPERVISOR: { bg: `${status.warning.solid}12`, fg: status.warning.solid },
  TECHNICIAN: { bg: `${status.success.solid}12`, fg: status.success.solid },
};
const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Quản trị', SUPERVISOR: 'Điều hành', TECHNICIAN: 'Kỹ thuật',
};

function RoleChips({ roles }: { roles: string[] }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
      {roles.map((r) => (
        <Chip key={r} label={ROLE_LABEL[r]} size="small"
          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: ROLE_TONE[r].bg, color: ROLE_TONE[r].fg }} />
      ))}
    </Box>
  );
}

/* ── 1 bước trong luồng thực hiện ───────────────────────────────────── */
function FlowStep({ icon, title, desc, color, idx }: {
  icon: React.ReactNode; title: string; desc: string; color: string; idx: number;
}) {
  return (
    <Box sx={{
      flex: { xs: '1 1 auto', sm: '1 1 180px' }, width: { xs: '100%', sm: 180 },
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', gap: 1, p: 2, borderRadius: 3,
      border: `1.5px solid ${color}30`, bgcolor: `${color}08`,
      position: 'relative',
    }}>
      <Box sx={{
        position: 'absolute', top: -10, left: 12, width: 22, height: 22, borderRadius: '50%',
        bgcolor: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.7rem', fontWeight: 800,
      }}>
        {idx}
      </Box>
      <Box sx={{
        width: 46, height: 46, borderRadius: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: `${color}18`, color,
      }}>
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: palette.text.primary }}>{title}</Typography>
      <Typography sx={{ fontSize: '0.78rem', color: palette.text.secondary, lineHeight: 1.4 }}>{desc}</Typography>
    </Box>
  );
}

const FLOW = [
  { icon: <GroupsOutlined />, title: 'Danh mục', desc: 'Khai báo Trạm và Giải pháp dùng chung cho toàn hệ thống', color: palette.brand.main },
  { icon: <CalendarMonth />, title: 'Kỳ thực hiện', desc: 'Tạo kỳ, gán Giải pháp + Trạm, cấu hình Google Sheet (nếu cần)', color: palette.accent.main },
  { icon: <Assignment />, title: 'Sinh Phiếu thi công', desc: 'Tự sinh theo tổ hợp Trạm × Giải pháp, hoặc đồng bộ từ Google Sheet', color: status.purple.solid },
  { icon: <ListAltOutlined />, title: 'Phiếu vật tư', desc: 'Viết phiếu → ACT nhận VT → TTKV nhận VT → VT lên trạm', color: status.warning.solid },
  { icon: <EngineeringOutlined />, title: 'Thi công', desc: 'Kỹ thuật cập nhật kế hoạch, lắp đặt, chụp hình, tích hợp', color: status.success.solid },
  { icon: <CloudSyncOutlined />, title: 'Đồng bộ Sheet', desc: 'Đọc trạng thái & tiến độ thi công đã có từ Sheet về hệ thống, ghi ngược tiến độ mới lên Sheet', color: status.info.solid },
  { icon: <Dashboard />, title: 'Theo dõi', desc: 'Dashboard tổng quan, Báo cáo phân tích, và Tra cứu trạm theo thời gian thực', color: palette.brand.dark },
];

/* ── 1 thẻ trang chức năng ───────────────────────────────────────────── */
function FeatureCard({ icon, title, desc, roles, path, color }: {
  icon: React.ReactNode; title: string; desc: string; roles: string[]; path: string; color: string;
}) {
  const navigate = useNavigate();
  return (
    <Box
      onClick={() => navigate(path)}
      sx={{
        display: 'flex', gap: 1.5, p: 2, borderRadius: 2.5, cursor: 'pointer',
        border: `1px solid ${palette.border}`, bgcolor: palette.card,
        transition: 'all 0.15s ease',
        '&:hover': { borderColor: color, boxShadow: `0 4px 16px ${color}20`, transform: 'translateY(-1px)' },
      }}
    >
      <Box sx={{
        width: 42, height: 42, flexShrink: 0, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: `${color}14`, color,
      }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: palette.text.primary }}>{title}</Typography>
        <Typography sx={{ fontSize: '0.78rem', color: palette.text.secondary, lineHeight: 1.4, mt: 0.25 }}>{desc}</Typography>
        <RoleChips roles={roles} />
      </Box>
    </Box>
  );
}

const FEATURES = [
  { icon: <CellTower />, title: 'Danh mục trạm', desc: 'Quản lý danh sách trạm BTS/NodeB, import/export Excel.', roles: ['ADMIN', 'SUPERVISOR'], path: '/sites', color: palette.brand.main },
  { icon: <Build />, title: 'Giải pháp', desc: 'Khai báo các giải pháp thi công và SLA tương ứng.', roles: ['ADMIN', 'SUPERVISOR'], path: '/solutions', color: palette.accent.main },
  { icon: <CalendarMonth />, title: 'Kỳ thực hiện', desc: 'Tạo kỳ, gán giải pháp + trạm, cấu hình đồng bộ Google Sheet, sinh phiếu. Kỳ "Đã đóng" sẽ không thể cập nhật/đồng bộ phiếu nữa.', roles: ['ADMIN', 'SUPERVISOR'], path: '/periods', color: status.purple.solid },
  { icon: <Assignment />, title: 'Phiếu thi công', desc: 'Danh sách phiếu theo kỳ, lọc theo TTKV, cập nhật phiếu & tiến độ thi công.', roles: ['ADMIN', 'SUPERVISOR', 'TECHNICIAN'], path: '/work-orders', color: status.success.solid },
  { icon: <ListAltOutlined />, title: 'Phiếu vật tư', desc: 'Theo dõi & cập nhật trạng thái viết phiếu, nhận/chuyển vật tư; đồng bộ Sheet.', roles: ['ADMIN', 'SUPERVISOR'], path: '/manager-orders', color: status.warning.solid },
  { icon: <ManageSearch />, title: 'Tra cứu trạm', desc: 'Tìm nhanh 1 trạm để xem toàn bộ phiếu thi công liên quan.', roles: ['ADMIN', 'SUPERVISOR', 'TECHNICIAN'], path: '/lookup', color: status.info.solid },
  { icon: <Dashboard />, title: 'Dashboard', desc: 'Tổng quan tiến độ theo kỳ, giải pháp, TTKV — chọn kỳ để xem riêng.', roles: ['ADMIN', 'SUPERVISOR', 'TECHNICIAN'], path: '/', color: palette.brand.dark },
  { icon: <AssessmentOutlined />, title: 'Báo cáo', desc: 'Bảng số liệu theo giải pháp: viết phiếu, nhận/chuyển vật tư, lắp đặt, tích hợp, hủy — báo cáo chung toàn công ty và riêng từng trung tâm (TTKV). Xuất Excel nhiều sheet.', roles: ['ADMIN', 'SUPERVISOR'], path: '/reports', color: status.purple.solid },
];

function Code({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="code"
      sx={{
        display: 'inline-block', bgcolor: '#F1F5F9', border: '1px solid #E2E8F0',
        borderRadius: 0.75, px: 0.75, py: 0.1,
        fontFamily: 'monospace', fontSize: '0.8rem', color: '#1E40AF',
        wordBreak: 'break-all',
      }}
    >
      {children}
    </Box>
  );
}

interface MappingRowData { col: string; field: string; direction: string; mapping: string }

function DirectionChip({ direction }: { direction: string }) {
  const dirColor = direction === 'Hai chiều' ? '#7C3AED' : direction === 'App → Sheet' ? '#0369A1' : '#15803D';
  const dirBg = direction === 'Hai chiều' ? '#F5F3FF' : direction === 'App → Sheet' ? '#EFF6FF' : '#F0FDF4';
  return <Chip size="small" label={direction} sx={{ bgcolor: dirBg, color: dirColor, fontWeight: 600, fontSize: '0.7rem' }} />;
}

function MappingRow({ col, field, direction, mapping }: MappingRowData) {
  return (
    <TableRow>
      <TableCell sx={{ fontSize: '0.8rem', fontWeight: 500 }}>{col}</TableCell>
      <TableCell sx={{ fontSize: '0.8rem' }}><Code>{field}</Code></TableCell>
      <TableCell><DirectionChip direction={direction} /></TableCell>
      <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{mapping}</TableCell>
    </TableRow>
  );
}

/** Bảng mapping — chuyển sang dạng card xếp dọc trên mobile để tránh vỡ layout do 4 cột + mô tả dài. */
function MappingTable({ rows }: { rows: MappingRowData[] }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>
        {rows.map((r, i) => (
          <Box key={i} sx={{ p: 1.25, borderRadius: 2, border: `1px solid ${palette.border}`, bgcolor: 'white' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{r.col}</Typography>
              <DirectionChip direction={r.direction} />
            </Box>
            <Box sx={{ mb: 0.5 }}><Code>{r.field}</Code></Box>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.5 }}>{r.mapping}</Typography>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Table size="small" sx={{ mb: 2.5 }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 600 }}>Cột Sheet</TableCell>
          <TableCell sx={{ fontWeight: 600 }}>Trường hệ thống</TableCell>
          <TableCell sx={{ fontWeight: 600 }}>Chiều</TableCell>
          <TableCell sx={{ fontWeight: 600 }}>Quy tắc convert giá trị</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r, i) => <MappingRow key={i} {...r} />)}
      </TableBody>
    </Table>
  );
}

const GROUP1_ROWS: MappingRowData[] = [
  { col: 'Cột mã trạm', field: 'Site.code', direction: 'Sheet → App', mapping: 'Khớp đúng mã trạm đã có trong hệ thống để xác định site' },
  { col: 'Cột genCol (riêng/giải pháp)', field: 'WorkOrder (tạo mới)', direction: 'Sheet → App', mapping: 'Ô = "1" → tạo WO; rỗng / "0" / giá trị khác → không tạo' },
];
const GROUP2_ROWS: MappingRowData[] = [
  { col: 'sheetWrittenCol — Viết phiếu', field: 'writtenTicket', direction: 'Sheet → App', mapping: 'Có nội dung → WRITTEN (Đã viết); rỗng → EMPTY (Trống)' },
  { col: 'sheetActCol — ACT nhận VT', field: 'actReceivedMaterial', direction: 'Sheet → App', mapping: 'Chứa "chuyển" → TRANSFERRED; chứa "nhận" → RECEIVED; còn lại → EMPTY' },
  { col: 'sheetTtkvCol — TTKV nhận VT', field: 'ttkvReceivedMaterial', direction: 'Sheet → App', mapping: 'Chứa "chuyển" → TRANSFERRED; chứa "nhận" → RECEIVED; còn lại → EMPTY' },
  { col: 'sheetSiteRecvCol — VT lên trạm', field: 'siteReceivedMaterial', direction: 'Sheet → App', mapping: 'Chứa "chuyển" → TRANSFERRED; chứa "nhận" → RECEIVED; còn lại → EMPTY' },
];
const GROUP3_ROWS: MappingRowData[] = [
  { col: 'sheetPlanDateCol — Ngày kế hoạch', field: 'planDate', direction: 'App → Sheet', mapping: 'Ghi nguyên giá trị ngày' },
  { col: 'sheetExecutorCol — Người thi công', field: 'executor', direction: 'App → Sheet', mapping: 'Ghi nguyên text' },
  { col: 'sheetInstallCol — Trạng thái TH', field: 'installationStatus', direction: 'Hai chiều', mapping: 'NOT_STARTED → "" ; IN_PROGRESS → "Đang TH" ; COMPLETED → "Hoàn thành" ; CANCELLED → "Hủy" (chiều ngược: rỗng → NOT_STARTED, chứa "hủy"/"huỷ" → CANCELLED, chứa "hoàn thành" → COMPLETED, có nội dung khác → IN_PROGRESS)' },
  { col: 'sheetPhotoCol — Chụp ảnh', field: 'photoStatus', direction: 'Hai chiều', mapping: 'NOT_TAKEN → "" ; TAKEN → "Đã chụp" (chiều ngược tương tự: rỗng → NOT_TAKEN, có nội dung → TAKEN)' },
  { col: 'sheetIntegrationCol — Tích hợp', field: 'integrationStatus', direction: 'App → Sheet', mapping: 'Ghi nguyên text trạng thái' },
  { col: 'sheetNoteCol — Ghi chú', field: 'note', direction: 'App → Sheet', mapping: 'Ghi nguyên text' },
  { col: 'sheetIssueCol — Vướng mắc', field: 'issue', direction: 'App → Sheet', mapping: 'Ghi nguyên text' },
  { col: 'sheetCompletedDateCol — Ngày hoàn thành', field: 'completedDate', direction: 'App → Sheet', mapping: 'Ghi nguyên giá trị ngày khi installationStatus = COMPLETED' },
];

function MappingGuide() {
  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        border: `1px solid ${palette.border}`,
        borderRadius: '8px !important',
        '&:before': { display: 'none' },
        bgcolor: '#FAFBFE',
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ px: { xs: 1.5, sm: 2.5 }, minHeight: 48 }}>
        <Typography sx={{ fontWeight: 600, fontSize: { xs: '0.8rem', sm: '0.875rem' }, color: palette.brand.dark }}>
          Giải thích mapping cột Google Sheet ↔ dữ liệu hệ thống
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: { xs: 1.5, sm: 2.5 }, pb: 2.5, pt: 0 }}>

        <Typography sx={{ fontSize: { xs: '0.76rem', sm: '0.82rem' }, color: '#374151', mb: 2 }}>
          Hệ thống có <strong>3 nhóm cấu hình cột Sheet độc lập</strong>, có thể trỏ tới các tab/cột khác nhau trong cùng
          một Spreadsheet. Mỗi cột chỉ phục vụ đúng một mục đích — không dùng chung cột giữa các nhóm.
        </Typography>

        {/* Nhóm 1 */}
        <Typography sx={{ fontWeight: 600, fontSize: { xs: '0.78rem', sm: '0.84rem' }, mb: 0.5, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
          1. Sinh phiếu thi công từ Sheet <Chip size="small" label="Sheet → App" sx={{ bgcolor: '#F0FDF4', color: '#15803D', fontWeight: 600, fontSize: '0.7rem' }} />
        </Typography>
        <Typography sx={{ fontSize: { xs: '0.72rem', sm: '0.78rem' }, color: 'text.secondary', mb: 1 }}>
          Cấu hình tại trang <strong>Kỳ thực hiện</strong> (Mã trạm, tab, hàng bắt đầu + cột "genCol" riêng cho từng giải pháp).
          Trigger thủ công bằng nút "Tạo WO từ Google Sheets".
        </Typography>
        <MappingTable rows={GROUP1_ROWS} />

        {/* Nhóm 2 */}
        <Typography sx={{ fontWeight: 600, fontSize: { xs: '0.78rem', sm: '0.84rem' }, mb: 0.5, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
          2. Trạng thái viết phiếu / nhận vật tư <Chip size="small" label="Sheet → App" sx={{ bgcolor: '#F0FDF4', color: '#15803D', fontWeight: 600, fontSize: '0.7rem' }} />
        </Typography>
        <Typography sx={{ fontSize: { xs: '0.72rem', sm: '0.78rem' }, color: 'text.secondary', mb: 1 }}>
          Cấu hình 4 cột riêng cho từng giải pháp. Đọc tự động theo lịch (xem mục "Lịch sử đồng bộ tự động" ở menu avatar) hoặc chạy thủ công.
          Chỉ áp dụng cho kỳ đang <strong>hoạt động</strong>.
        </Typography>
        <MappingTable rows={GROUP2_ROWS} />

        {/* Nhóm 3 */}
        <Typography sx={{ fontWeight: 600, fontSize: { xs: '0.78rem', sm: '0.84rem' }, mb: 0.5, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
          3. Tiến độ thi công <Chip size="small" label="Hai chiều" sx={{ bgcolor: '#F5F3FF', color: '#7C3AED', fontWeight: 600, fontSize: '0.7rem' }} />
        </Typography>
        <Typography sx={{ fontSize: { xs: '0.72rem', sm: '0.78rem' }, color: 'text.secondary', mb: 1 }}>
          Khi người dùng cập nhật phiếu trên web, hệ thống <strong>ghi ngược</strong> lên Sheet ngay (App → Sheet).
          Ngoài ra có thể chạy đồng bộ chiều ngược lại (Sheet → App) thủ công để kéo dữ liệu đã sửa trực tiếp trên Sheet về.
        </Typography>
        <MappingTable rows={GROUP3_ROWS} />

        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 1 }}>
          <Typography sx={{ fontSize: { xs: '0.72rem', sm: '0.78rem' }, color: '#92400E' }}>
            <strong>Lưu ý quan trọng:</strong> Với cột vật tư (nhóm 2), hệ thống nhận diện theo <strong>từ khóa</strong>{' '}
            ("chuyển"/"nhận") trong nội dung ô, không so khớp chính xác — người nhập liệu trên Sheet cần gõ đúng các từ khóa này
            để hệ thống nhận diện đúng trạng thái. Với enum trạng thái ở nhóm 3, quy ước là: giá trị rỗng trên hệ thống ↔ ô Sheet để trống.
          </Typography>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

export default function GuidePage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1100, px: { xs: 0, md: 0 } }}>
      <PageHeader title="Hướng dẫn sử dụng" subtitle="Giới thiệu hệ thống và luồng thực hiện công việc" />

      {/* ── Giới thiệu ── */}
      <Box sx={{ bgcolor: palette.card, border: `1px solid ${palette.border}`, borderRadius: 3, p: 2.5 }}>
        <Typography sx={{ fontSize: '0.875rem', color: palette.text.secondary, lineHeight: 1.7 }}>
          <strong style={{ color: palette.text.primary }}>ACT Điều hành</strong> là hệ thống quản lý tiến độ thi công viễn thông,
          thay thế việc theo dõi bằng Excel. Toàn bộ vòng đời 1 hạng mục thi công đi qua các bước:
          khai báo danh mục → tạo kỳ thực hiện → sinh phiếu thi công → cập nhật phiếu vật tư → kỹ thuật thi công → đồng bộ Google Sheet (nếu dùng).
          Mỗi vai trò (Quản trị / Điều hành / Kỹ thuật) chỉ thấy và thao tác trên phần việc liên quan.
        </Typography>
      </Box>

      {/* ── Luồng thực hiện ── */}
      <Box>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: palette.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
          Luồng thực hiện
        </Typography>
        <Box sx={{
          display: 'flex', flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5,
        }}>
          {FLOW.map((step, idx) => (
            <Box key={step.title} sx={{
              display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center', gap: 1.5, width: { xs: '100%', sm: 'auto' },
            }}>
              {idx > 0 && (
                <>
                  <ArrowDownward sx={{ display: { xs: 'block', sm: 'none' }, color: palette.text.faint, fontSize: 18, flexShrink: 0 }} />
                  <ArrowForward sx={{ display: { xs: 'none', sm: 'block' }, color: palette.text.faint, fontSize: 18, flexShrink: 0 }} />
                </>
              )}
              <FlowStep {...step} idx={idx + 1} />
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Trang chức năng ── */}
      <Box>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: palette.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
          Các trang chức năng
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          {FEATURES.map((f) => <FeatureCard key={f.path} {...f} />)}
        </Box>
      </Box>

      {/* ── Vai trò ── */}
      <Box>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: palette.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>
          Phân quyền theo vai trò
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          {[
            { icon: <AdminPanelSettingsOutlined />, role: 'ADMIN', desc: 'Toàn quyền: danh mục, kỳ thực hiện, người dùng, cài đặt hệ thống, đồng bộ Sheet, xem Báo cáo.' },
            { icon: <SupervisorAccountOutlined />, role: 'SUPERVISOR', desc: 'Quản lý danh mục, kỳ thực hiện, sinh phiếu, cập nhật phiếu vật tư & thi công, đồng bộ Sheet, xem Báo cáo.' },
            { icon: <EngineeringOutlined />, role: 'TECHNICIAN', desc: 'Cập nhật tiến độ thi công: kế hoạch, lắp đặt, chụp hình, tích hợp.' },
          ].map((r) => (
            <Box key={r.role} sx={{ display: 'flex', gap: 1.5, p: 2, borderRadius: 2.5, border: `1px solid ${palette.border}`, bgcolor: palette.card }}>
              <Box sx={{
                width: 38, height: 38, flexShrink: 0, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: ROLE_TONE[r.role].bg, color: ROLE_TONE[r.role].fg,
              }}>
                {r.icon}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', color: palette.text.primary }}>{ROLE_LABEL[r.role]}</Typography>
                <Typography sx={{ fontSize: '0.78rem', color: palette.text.secondary, lineHeight: 1.4, mt: 0.25 }}>{r.desc}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Mapping Google Sheet ── */}
      <MappingGuide />
    </Box>
  );
}
