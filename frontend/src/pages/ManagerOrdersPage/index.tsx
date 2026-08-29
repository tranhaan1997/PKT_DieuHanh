import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box, Button, Typography, FormControl, InputLabel, Select, MenuItem,
  TextField, Snackbar, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, LinearProgress, CircularProgress, Drawer, Stack, IconButton, Tooltip,
  useMediaQuery, useTheme, Checkbox, FormControlLabel,
} from '@mui/material';
import {
  DownloadOutlined, FilterAltOffOutlined, RefreshOutlined,
  EditOutlined, Close, Assignment, SyncOutlined, CheckCircleOutlined, ErrorOutlined, SyncProblemOutlined,
} from '@mui/icons-material';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPeriods } from '../../api/periods';
import { getSolutions } from '../../api/solutions';
import { getWorkOrders, exportWorkOrders, importMaterials, updateWorkOrder, retrySheetSync, dismissSheetSyncError } from '../../api/workOrders';
import { getApiErrorMessage } from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';
import DataGrid from '../../components/ui/DataGrid';
import StatusChip from '../../components/ui/StatusChip';
import MobileList, { MobileCard } from '../../components/ui/MobileList';
import StatusSyncDialog from '../../components/ui/StatusSyncDialog';
import ProgressSyncDialog from '../../components/ui/ProgressSyncDialog';
import { useAuth } from '../../hooks/useAuth';
import { useTopBar } from '../../components/layout/TopBarContext';
import { palette, status as st } from '../../theme/tokens';
import type { StatusKey } from '../../theme/tokens';
import type { WorkOrder } from '../../types';
import { downloadBlob } from '../../utils/download';

const WRITTEN_LABEL: Record<string, string> = { EMPTY: 'Chưa viết', WRITTEN: 'Đã viết' };
const WRITTEN_TONE: Record<string, StatusKey> = { EMPTY: 'neutral', WRITTEN: 'success' };
const MAT_LABEL: Record<string, string> = { EMPTY: 'Chưa nhận', RECEIVED: 'Đã nhận', TRANSFERRED: 'Đã chuyển' };
const MAT_TONE: Record<string, StatusKey> = { EMPTY: 'neutral', RECEIVED: 'info', TRANSFERRED: 'success' };
const INSTALL_LABEL: Record<string, string> = { NOT_STARTED: 'Chưa TH', IN_PROGRESS: 'Đang TH', COMPLETED: 'Hoàn thành', CANCELLED: 'Hủy' };
const INSTALL_TONE: Record<string, StatusKey> = { NOT_STARTED: 'neutral', IN_PROGRESS: 'info', COMPLETED: 'success', CANCELLED: 'error' };
const PHOTO_LABEL: Record<string, string> = { NOT_TAKEN: 'Chưa chụp', TAKEN: 'Đã chụp' };
const PHOTO_TONE: Record<string, StatusKey> = { NOT_TAKEN: 'neutral', TAKEN: 'success' };

const fmtDate = (v: any) => (v ? new Date(v as string).toLocaleDateString('vi-VN') : '—');

const WRITTEN_OPTS  = [{ value: 'EMPTY', label: 'Chưa viết' }, { value: 'WRITTEN', label: 'Đã viết' }];
const MATERIAL_OPTS = [{ value: 'EMPTY', label: 'Chưa nhận' }, { value: 'RECEIVED', label: 'Đã nhận' }, { value: 'TRANSFERRED', label: 'Đã chuyển' }];

function SelectField({ label, value, onChange, options, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean;
}) {
  return (
    <FormControl size="small" fullWidth disabled={disabled}>
      <InputLabel>{label}</InputLabel>
      <Select value={value || ''} label={label} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

function OfficeDrawer({ wo, onClose, onSave, saving, forceReadOnly }: {
  wo: WorkOrder; onClose: () => void;
  onSave: (c: Partial<WorkOrder>) => void; saving?: boolean; forceReadOnly?: boolean;
}) {
  const readOnly = forceReadOnly || (wo as any).period?.status === 'CLOSED';
  const [form, setForm] = useState({
    writtenTicket: wo.writtenTicket,
    actReceivedMaterial: wo.actReceivedMaterial,
    ttkvReceivedMaterial: wo.ttkvReceivedMaterial,
    siteReceivedMaterial: wo.siteReceivedMaterial,
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{(wo as any).site?.siteCode} — {(wo as any).site?.siteName}</Typography>
          <Typography variant="body2" color="text.secondary">{(wo as any).solution?.solutionName}</Typography>
          <Typography variant="caption" color="text.secondary">{wo.ticketNo} · {(wo as any).site?.ttkvCode}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ p: 2, flex: 1, overflowY: 'auto' }}>
        <Stack spacing={2}>
          {readOnly && (
            <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>Kỳ đã đóng — chỉ xem, không thể cập nhật.</Alert>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assignment fontSize="small" color="primary" />
            <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Phiếu &amp; Vật tư</Typography>
          </Box>
          <SelectField label="Phiếu vật tư" value={form.writtenTicket} onChange={(v) => set('writtenTicket', v)} options={WRITTEN_OPTS} disabled={readOnly} />
          <SelectField label="ACT nhận VT" value={form.actReceivedMaterial} onChange={(v) => set('actReceivedMaterial', v)} options={MATERIAL_OPTS} disabled={readOnly} />
          <SelectField label="TTKV nhận VT" value={form.ttkvReceivedMaterial} onChange={(v) => set('ttkvReceivedMaterial', v)} options={MATERIAL_OPTS} disabled={readOnly} />
          <SelectField label="Đã chuyển VT lên trạm" value={form.siteReceivedMaterial} onChange={(v) => set('siteReceivedMaterial', v)} options={MATERIAL_OPTS} disabled={readOnly} />
        </Stack>
      </Box>
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>Đóng</Button>
        {!readOnly && (
          <Button variant="contained" startIcon={<Assignment />} onClick={() => onSave(form)} disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        )}
      </Box>
    </Box>
  );
}

export default function ManagerOrdersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canSyncStatus = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const fileRef = useRef<HTMLInputElement>(null);
  const MOBILE_PAGE_SIZE = 30;
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_PAGE_SIZE);

  const [periodId, setPeriodId] = useState('');
  const [solutionId, setSolutionId] = useState('');
  const [writtenFilter, setWrittenFilter] = useState('');
  const [actFilter, setActFilter] = useState('');
  const [syncErrorOnly, setSyncErrorOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [importResult, setImportResult] = useState<{ updated: number; errors: string[]; total: number } | null>(null);
  const [snack, setSnack] = useState<{ msg: string; sev?: 'success' | 'error' }>({ msg: '' });
  const [activeWO, setActiveWO] = useState<WorkOrder | null>(null);
  const [statusSyncOpen, setStatusSyncOpen] = useState(false);
  const [progressSyncOpen, setProgressSyncOpen] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string> = { limit: '5000' };
    if (periodId) p.periodId = periodId;
    if (solutionId) p.solutionId = solutionId;
    if (search) p.search = search;
    return p;
  }, [periodId, solutionId, search]);

  const { data: periodsData } = useQuery({ queryKey: ['periods'], queryFn: () => getPeriods().then(r => r.data) });
  const { data: solutionsData } = useQuery({ queryKey: ['solutions'], queryFn: () => getSolutions().then(r => r.data) });
  const { data: woData, isLoading, refetch } = useQuery({
    queryKey: ['manager-orders', params],
    queryFn: () => getWorkOrders(params).then(r => r.data),
  });

  const allWOs = woData?.data || [];
  const filteredWOs = useMemo(() => allWOs.filter(wo => {
    if (writtenFilter && wo.writtenTicket !== writtenFilter) return false;
    if (actFilter && wo.actReceivedMaterial !== actFilter) return false;
    if (syncErrorOnly && !wo.sheetSyncError) return false;
    return true;
  }), [allWOs, writtenFilter, actFilter, syncErrorOnly]);

  useEffect(() => { setMobileVisibleCount(MOBILE_PAGE_SIZE); }, [periodId, solutionId, writtenFilter, actFilter, syncErrorOnly, search]);

  const importMutation = useMutation({
    mutationFn: (file: File) => importMaterials(file).then(r => r.data),
    onSuccess: (data) => {
      setImportResult(data);
      qc.invalidateQueries({ queryKey: ['manager-orders'] });
      qc.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: (e: any) => setSnack({ msg: e?.response?.data?.message || 'Import thất bại', sev: 'error' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<WorkOrder> }) => updateWorkOrder(id, changes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager-orders'] });
      qc.invalidateQueries({ queryKey: ['work-orders'] });
      setSnack({ msg: 'Đã lưu' });
      setActiveWO(null);
    },
    onError: (err) => setSnack({ msg: getApiErrorMessage(err, 'Lỗi khi lưu'), sev: 'error' }),
  });

  const handleSave = useCallback((changes: Partial<WorkOrder>) => {
    if (!activeWO) return;
    updateMutation.mutate({ id: activeWO.id, changes });
  }, [activeWO]);

  const retryMutation = useMutation({
    mutationFn: (id: number) => retrySheetSync(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['manager-orders'] });
      setSnack(res.success ? { msg: 'Đã đồng bộ lại lên Sheet' } : { msg: `Lỗi: ${res.error}`, sev: 'error' });
    },
    onError: () => setSnack({ msg: 'Đồng bộ lại thất bại', sev: 'error' }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) => dismissSheetSyncError(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager-orders'] });
      setSnack({ msg: 'Đã bỏ qua lỗi đồng bộ' });
    },
    onError: () => setSnack({ msg: 'Bỏ qua lỗi thất bại', sev: 'error' }),
  });

  const [bulkRetrying, setBulkRetrying] = useState(false);
  const handleBulkRetry = async (ids: number[]) => {
    setBulkRetrying(true);
    let ok = 0, fail = 0;
    for (const id of ids) {
      try {
        const res = await retrySheetSync(id);
        if (res.success) ok++; else fail++;
      } catch { fail++; }
    }
    setBulkRetrying(false);
    qc.invalidateQueries({ queryKey: ['manager-orders'] });
    setSnack({ msg: `Đồng bộ lại: ${ok} thành công, ${fail} lỗi`, sev: fail > 0 ? 'error' : undefined });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importMutation.mutate(file);
    e.target.value = '';
  };

  const handleExport = async () => {
    try {
      const res = await exportWorkOrders(params);
      downloadBlob(res.data, 'phieu-vat-tu.xlsx');
    } catch {
      setSnack({ msg: 'Xuất Excel thất bại', sev: 'error' });
    }
  };

  const hasFilter = !!(periodId || solutionId || writtenFilter || actFilter || syncErrorOnly || search);
  const selectedPeriod = (periodsData || []).find((p: any) => String(p.id) === periodId);
  const selectedSolution = (solutionsData || []).find((s: any) => String(s.id) === solutionId);
  const isPeriodClosed = selectedPeriod?.status === 'CLOSED';

  const colDefs = useMemo<ColDef[]>(() => [
    {
      headerName: '', width: 46, pinned: 'left', sortable: false, filter: false,
      cellRenderer: (p: ICellRendererParams) => (
        <IconButton size="small" onClick={() => setActiveWO(p.data)} sx={{ color: palette.brand.main }}>
          <EditOutlined fontSize="small" />
        </IconButton>
      ),
    },
    { field: 'ticketNo', headerName: 'Ticket No', width: 150, pinned: 'left' },
    { field: 'site.ttkvCode', headerName: 'TTKV', width: 100 },
    { field: 'period.periodName', headerName: 'Kỳ thực hiện', width: 180 },
    { field: 'site.siteCode', headerName: 'Mã trạm', width: 120 },
    { field: 'site.siteName', headerName: 'Tên trạm', flex: 1, minWidth: 160 },
    { field: 'site.province', headerName: 'Tỉnh/Thành', width: 130 },
    { field: 'solution.solutionName', headerName: 'Giải pháp', width: 180 },
    {
      field: 'writtenTicket', headerName: 'Phiếu vật tư', width: 130,
      valueGetter: (p: any) => WRITTEN_LABEL[p.data?.writtenTicket] ?? p.data?.writtenTicket,
      cellRenderer: ({ value, data }: any) => (
        <StatusChip label={value} tone={WRITTEN_TONE[data?.writtenTicket] ?? 'neutral'} />
      ),
    },
    {
      field: 'actReceivedMaterial', headerName: 'ACT nhận VT', width: 130,
      valueGetter: (p: any) => MAT_LABEL[p.data?.actReceivedMaterial] ?? p.data?.actReceivedMaterial,
      cellRenderer: ({ value, data }: any) => (
        <StatusChip label={value} tone={MAT_TONE[data?.actReceivedMaterial] ?? 'neutral'} />
      ),
    },
    {
      field: 'ttkvReceivedMaterial', headerName: 'TTKV nhận VT', width: 140,
      valueGetter: (p: any) => MAT_LABEL[p.data?.ttkvReceivedMaterial] ?? p.data?.ttkvReceivedMaterial,
      cellRenderer: ({ value, data }: any) => (
        <StatusChip label={value} tone={MAT_TONE[data?.ttkvReceivedMaterial] ?? 'neutral'} />
      ),
    },
    {
      field: 'siteReceivedMaterial', headerName: 'Đã chuyển VT lên trạm', width: 170,
      valueGetter: (p: any) => MAT_LABEL[p.data?.siteReceivedMaterial] ?? p.data?.siteReceivedMaterial,
      cellRenderer: ({ value, data }: any) => (
        <StatusChip label={value} tone={MAT_TONE[data?.siteReceivedMaterial] ?? 'neutral'} />
      ),
    },
    {
      headerName: 'Kế hoạch TH', width: 120,
      valueGetter: (p: any) => p.data?.planDate ?? null,
      valueFormatter: (p: any) => fmtDate(p.value),
    },
    { field: 'executorName', headerName: 'NS thực hiện', width: 140, valueFormatter: (p: any) => p.value || '—' },
    {
      field: 'installationStatus', headerName: 'Lắp đặt', width: 120,
      valueGetter: (p: any) => INSTALL_LABEL[p.data?.installationStatus] ?? p.data?.installationStatus,
      cellRenderer: ({ value, data }: any) => (
        <StatusChip label={value} tone={INSTALL_TONE[data?.installationStatus] ?? 'neutral'} />
      ),
    },
    {
      field: 'photoStatus', headerName: 'Chụp hình', width: 110,
      valueGetter: (p: any) => PHOTO_LABEL[p.data?.photoStatus] ?? p.data?.photoStatus,
      cellRenderer: ({ value, data }: any) => (
        <StatusChip label={value} tone={PHOTO_TONE[data?.photoStatus] ?? 'neutral'} />
      ),
    },
    {
      field: 'integrationStatus', headerName: 'Tích hợp', width: 120,
      valueGetter: (p: any) => INSTALL_LABEL[p.data?.integrationStatus] ?? p.data?.integrationStatus,
      cellRenderer: ({ value, data }: any) => (
        <StatusChip label={value} tone={INSTALL_TONE[data?.integrationStatus] ?? 'neutral'} />
      ),
    },
    {
      headerName: 'Ngày hoàn thành', width: 130,
      valueGetter: (p: any) => p.data?.completedDate ?? null,
      valueFormatter: (p: any) => fmtDate(p.value),
    },
    { field: 'note', headerName: 'Ghi chú', width: 160, valueFormatter: (p: any) => p.value || '—' },
    { field: 'issue', headerName: 'Vướng mắc', width: 160, valueFormatter: (p: any) => p.value || '—' },
    {
      headerName: 'Người cập nhật PT', width: 155,
      valueGetter: (p: any) => p.data?.officeUpdatedBy?.fullName ?? '—',
    },
    {
      headerName: 'TG cập nhật PT', width: 150,
      valueGetter: (p: any) => p.data?.officeUpdatedAt ?? null,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleString('vi-VN') : '—',
    },
    {
      headerName: 'Người cập nhật tiến độ', width: 165,
      valueGetter: (p: any) => p.data?.techUpdatedBy?.fullName ?? '—',
    },
    {
      headerName: 'TG cập nhật tiến độ', width: 150,
      valueGetter: (p: any) => p.data?.techUpdatedAt ?? null,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleString('vi-VN') : '—',
    },
    { field: 'createdAt', headerName: 'Ngày tạo', width: 110, valueFormatter: p => fmtDate(p.value) },
    {
      headerName: 'Đồng bộ Sheet', width: 210, sortable: false, filter: false,
      cellRenderer: (p: ICellRendererParams) => {
        const wo = p.data as WorkOrder;
        if (wo.sheetSyncError) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Tooltip title={wo.sheetSyncError} arrow>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: st.error.solid, cursor: 'pointer' }}
                  onClick={() => retryMutation.mutate(wo.id)}>
                  <ErrorOutlined sx={{ fontSize: 16 }} />
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 600 }}>Lỗi — Thử lại</Typography>
                </Box>
              </Tooltip>
              <Tooltip title="Bỏ qua — đã tự cập nhật tay lên Sheet" arrow>
                <IconButton size="small" sx={{ p: 0.25 }} onClick={() => dismissMutation.mutate(wo.id)}>
                  <Close sx={{ fontSize: 14, color: palette.text.muted }} />
                </IconButton>
              </Tooltip>
            </Box>
          );
        }
        if (wo.sheetSyncedAt) {
          return (
            <Tooltip title={`Đã đồng bộ lúc ${new Date(wo.sheetSyncedAt).toLocaleString('vi-VN')}`} arrow>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: st.success.solid }}>
                <CheckCircleOutlined sx={{ fontSize: 16 }} />
                <Typography sx={{ fontSize: '0.72rem' }}>Đã đồng bộ</Typography>
              </Box>
            </Tooltip>
          );
        }
        return <Typography sx={{ fontSize: '0.72rem', color: palette.text.muted }}>—</Typography>;
      },
    },
  ], [retryMutation, dismissMutation]);

  const syncErrorWOs = useMemo(() => filteredWOs.filter((wo) => wo.sheetSyncError), [filteredWOs]);

  // Trên mobile, đưa nút đồng bộ trạng thái thành icon ở header (thay vì lặp lại trong PageHeader)
  const { setAction, clearAction } = useTopBar();
  useEffect(() => {
    if (isMobile && canSyncStatus) {
      const disabled = !selectedPeriod || !selectedSolution || isPeriodClosed;
      setAction(
        <Tooltip title={isPeriodClosed ? 'Kỳ đã đóng — không thể đồng bộ' : disabled ? 'Chọn Kỳ thực hiện và Giải pháp để đồng bộ' : 'Đồng bộ trạng thái từ Sheet'} arrow>
          <span>
            <IconButton size="small" disabled={disabled} onClick={() => setStatusSyncOpen(true)}
              sx={{ color: disabled ? palette.text.muted : palette.brand.main }}>
              <SyncOutlined fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>,
      );
    } else {
      clearAction();
    }
    return () => clearAction();
  }, [isMobile, canSyncStatus, selectedPeriod, selectedSolution, isPeriodClosed]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: { xs: 'calc(100dvh - 148px)', md: 'calc(100vh - 102px)' } }}>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />

      {!isMobile && (
        <PageHeader
          title="Quản lý phiếu vật tư"
          subtitle={`${filteredWOs.length} phiếu`}
          actions={
            <Box sx={{ display: 'flex', gap: 1 }}>
              {canSyncStatus && (
                <Tooltip title={isPeriodClosed ? 'Kỳ đã đóng — không thể đồng bộ' : !selectedPeriod || !selectedSolution ? 'Chọn Kỳ thực hiện và Giải pháp để đồng bộ' : ''} arrow>
                  <span>
                    <Button size="small" variant="outlined" startIcon={<SyncOutlined />}
                      disabled={!selectedPeriod || !selectedSolution || isPeriodClosed}
                      onClick={() => setStatusSyncOpen(true)}>
                      Đồng bộ trạng thái từ Sheet
                    </Button>
                  </span>
                </Tooltip>
              )}
              {canSyncStatus && (
                <Tooltip title={isPeriodClosed ? 'Kỳ đã đóng — không thể đồng bộ' : !selectedPeriod || !selectedSolution ? 'Chọn Kỳ thực hiện và Giải pháp để đồng bộ' : 'Lấy tiến độ thi công đã có sẵn trên Sheet về hệ thống'} arrow>
                  <span>
                    <Button size="small" variant="outlined" startIcon={<SyncOutlined />}
                      disabled={!selectedPeriod || !selectedSolution || isPeriodClosed}
                      onClick={() => setProgressSyncOpen(true)}>
                      Đồng bộ tiến độ thi công từ Sheet
                    </Button>
                  </span>
                </Tooltip>
              )}
              {syncErrorWOs.length > 0 && (
                <Button size="small" variant="outlined" color="error"
                  startIcon={bulkRetrying ? <CircularProgress size={14} color="inherit" /> : <SyncProblemOutlined />}
                  disabled={bulkRetrying}
                  onClick={() => handleBulkRetry(syncErrorWOs.map((wo) => wo.id))}>
                  Đồng bộ lại {syncErrorWOs.length} phiếu lỗi
                </Button>
              )}
              <Button size="small" variant="outlined" startIcon={<DownloadOutlined />} onClick={handleExport}>
                Xuất Excel
              </Button>
            </Box>
          }
        />
      )}

      {isMobile && syncErrorWOs.length > 0 && (
        <Button size="small" variant="outlined" color="error" fullWidth
          startIcon={bulkRetrying ? <CircularProgress size={14} color="inherit" /> : <SyncProblemOutlined />}
          disabled={bulkRetrying}
          onClick={() => handleBulkRetry(syncErrorWOs.map((wo) => wo.id))}>
          Đồng bộ lại {syncErrorWOs.length} phiếu lỗi
        </Button>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 }, flex: { xs: '1 1 100%', sm: 'initial' } }}>
          <InputLabel>Kỳ thực hiện</InputLabel>
          <Select value={periodId} label="Kỳ thực hiện" onChange={e => setPeriodId(e.target.value)}>
            <MenuItem value="">Tất cả</MenuItem>
            {(periodsData || []).map((p: any) => (
              <MenuItem key={p.id} value={String(p.id)}>{p.periodName}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {isPeriodClosed && <StatusChip label="Kỳ đã đóng — chỉ xem" tone="neutral" />}

        <FormControl size="small" sx={{ minWidth: { xs: 140, sm: 180 }, flex: { xs: 1, sm: 'initial' } }}>
          <InputLabel>Giải pháp</InputLabel>
          <Select value={solutionId} label="Giải pháp" onChange={e => setSolutionId(e.target.value)}>
            <MenuItem value="">Tất cả</MenuItem>
            {(solutionsData || []).map((s: any) => (
              <MenuItem key={s.id} value={String(s.id)}>{s.solutionName}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {!isMobile && (
          <>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Phiếu vật tư</InputLabel>
              <Select value={writtenFilter} label="Phiếu vật tư" onChange={e => setWrittenFilter(e.target.value)}>
                <MenuItem value="">Tất cả</MenuItem>
                <MenuItem value="EMPTY">Chưa viết</MenuItem>
                <MenuItem value="WRITTEN">Đã viết</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>ACT nhận VT</InputLabel>
              <Select value={actFilter} label="ACT nhận VT" onChange={e => setActFilter(e.target.value)}>
                <MenuItem value="">Tất cả</MenuItem>
                <MenuItem value="EMPTY">Chưa nhận</MenuItem>
                <MenuItem value="RECEIVED">Đã nhận</MenuItem>
                <MenuItem value="TRANSFERRED">Đã chuyển</MenuItem>
              </Select>
            </FormControl>
          </>
        )}

        <FormControlLabel
          sx={{ ml: { sm: 0.5 } }}
          control={<Checkbox size="small" checked={syncErrorOnly} onChange={(e) => setSyncErrorOnly(e.target.checked)} />}
          label={<Typography sx={{ fontSize: '0.82rem', color: palette.text.secondary }}>Chỉ phiếu lỗi đồng bộ Sheet</Typography>}
        />

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: { xs: '100%', sm: 'auto' }, flex: { sm: 'initial' }, ml: { sm: 'auto' } }}>
          <TextField size="small" placeholder="Tìm ticket / mã trạm / tên trạm..."
            value={search} onChange={e => setSearch(e.target.value)} sx={{ flex: { xs: 1, sm: 'initial' }, width: { sm: 260 } }} />

          {hasFilter && (
            isMobile ? (
              <IconButton size="small" onClick={() => { setPeriodId(''); setSolutionId(''); setWrittenFilter(''); setActFilter(''); setSyncErrorOnly(false); setSearch(''); }}>
                <FilterAltOffOutlined fontSize="small" />
              </IconButton>
            ) : (
              <Button size="small" startIcon={<FilterAltOffOutlined />}
                onClick={() => { setPeriodId(''); setSolutionId(''); setWrittenFilter(''); setActFilter(''); setSyncErrorOnly(false); setSearch(''); }}>
                Xóa lọc
              </Button>
            )
          )}

          {isMobile ? (
            <IconButton size="small" onClick={() => refetch()} sx={{ color: palette.brand.main }}>
              <RefreshOutlined fontSize="small" />
            </IconButton>
          ) : (
            <Button size="small" startIcon={<RefreshOutlined />} onClick={() => refetch()}>
              Làm mới
            </Button>
          )}
        </Box>
      </Box>

      {importMutation.isPending && <LinearProgress sx={{ borderRadius: 1 }} />}

      {isMobile ? (
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <MobileList loading={isLoading} count={filteredWOs.length} empty="Không tìm thấy phiếu vật tư">
            {filteredWOs.slice(0, mobileVisibleCount).map((wo) => (
              <MobileCard
                key={wo.id}
                title={wo.ticketNo}
                subtitle={`${(wo as any).site?.siteCode} · ${(wo as any).solution?.solutionName}`}
                meta={[(wo as any).site?.siteName, (wo as any).site?.province].filter(Boolean).join(' · ')}
                chips={[
                  { label: WRITTEN_LABEL[wo.writtenTicket] ?? wo.writtenTicket, tone: WRITTEN_TONE[wo.writtenTicket] ?? 'neutral' },
                  { label: `ACT: ${MAT_LABEL[wo.actReceivedMaterial] ?? wo.actReceivedMaterial}`, tone: MAT_TONE[wo.actReceivedMaterial] ?? 'neutral' },
                  { label: `TTKV: ${MAT_LABEL[wo.ttkvReceivedMaterial] ?? wo.ttkvReceivedMaterial}`, tone: MAT_TONE[wo.ttkvReceivedMaterial] ?? 'neutral' },
                ]}
                onEdit={() => setActiveWO(wo)}
              >
                {wo.sheetSyncError ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: st.error.solid, mt: 0.5 }}
                    onClick={() => retryMutation.mutate(wo.id)}>
                    <ErrorOutlined sx={{ fontSize: 15 }} />
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 600 }}>Lỗi đồng bộ Sheet — chạm để thử lại</Typography>
                  </Box>
                ) : wo.sheetSyncedAt ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: st.success.solid, mt: 0.5 }}>
                    <CheckCircleOutlined sx={{ fontSize: 15 }} />
                    <Typography sx={{ fontSize: '0.72rem' }}>Đã đồng bộ Sheet</Typography>
                  </Box>
                ) : null}
              </MobileCard>
            ))}
          </MobileList>
          {filteredWOs.length > mobileVisibleCount && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <Button size="small" variant="outlined"
                onClick={() => setMobileVisibleCount((c) => c + MOBILE_PAGE_SIZE)}>
                Xem thêm ({filteredWOs.length - mobileVisibleCount} phiếu)
              </Button>
            </Box>
          )}
        </Box>
      ) : (
        <DataGrid
          rowData={filteredWOs}
          columnDefs={colDefs}
          loading={isLoading}
          pagination
          paginationPageSize={100}
          paginationPageSizeSelector={[50, 100, 200, 500]}
        />
      )}

      {/* Edit drawer */}
      <Drawer anchor="right" open={!!activeWO} onClose={() => setActiveWO(null)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 400 } } } }}>
        {activeWO && (
          <OfficeDrawer
            wo={activeWO}
            onClose={() => setActiveWO(null)}
            onSave={handleSave}
            saving={updateMutation.isPending}
            forceReadOnly={user?.role === 'VIEWER'}
          />
        )}
      </Drawer>

      {/* Import result dialog */}
      <Dialog open={!!importResult} onClose={() => setImportResult(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Kết quả import phiếu vật tư</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 3, mb: 2, mt: 1 }}>
            {[
              { label: 'Tổng dòng', value: importResult?.total ?? 0, color: palette.text.primary },
              { label: 'Đã cập nhật', value: importResult?.updated ?? 0, color: st.success.solid },
              { label: 'Lỗi', value: importResult?.errors.length ?? 0, color: st.error.solid },
            ].map(s => (
              <Box key={s.label} sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: palette.text.muted }}>{s.label}</Typography>
              </Box>
            ))}
          </Box>
          {(importResult?.errors.length ?? 0) > 0 && (
            <Box sx={{ bgcolor: `${st.error.solid}08`, border: `1px solid ${st.error.solid}30`, borderRadius: 1.5, p: 1.5, maxHeight: 200, overflowY: 'auto' }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: st.error.solid, mb: 0.75 }}>Không tìm thấy ticket:</Typography>
              {importResult?.errors.map((e, i) => (
                <Typography key={i} sx={{ fontSize: '0.8rem', color: palette.text.secondary }}>{e}</Typography>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setImportResult(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      {canSyncStatus && statusSyncOpen && selectedPeriod && selectedSolution && (
        <StatusSyncDialog
          open={statusSyncOpen}
          periodCode={selectedPeriod.periodCode}
          solutionId={selectedSolution.id}
          solutionName={selectedSolution.solutionName}
          onClose={() => setStatusSyncOpen(false)}
          onSuccess={(updated) => {
            qc.invalidateQueries({ queryKey: ['manager-orders'] });
            qc.invalidateQueries({ queryKey: ['work-orders'] });
            setStatusSyncOpen(false);
            setSnack({ msg: `Đã cập nhật trạng thái cho ${updated} phiếu thi công` });
          }}
        />
      )}

      {canSyncStatus && progressSyncOpen && selectedPeriod && selectedSolution && (
        <ProgressSyncDialog
          open={progressSyncOpen}
          periodCode={selectedPeriod.periodCode}
          solutionId={selectedSolution.id}
          solutionName={selectedSolution.solutionName}
          onClose={() => setProgressSyncOpen(false)}
          onSuccess={(updated) => {
            qc.invalidateQueries({ queryKey: ['manager-orders'] });
            qc.invalidateQueries({ queryKey: ['work-orders'] });
            setProgressSyncOpen(false);
            setSnack({ msg: `Đã cập nhật tiến độ thi công cho ${updated} phiếu thi công` });
          }}
        />
      )}

      <Snackbar open={!!snack.msg} autoHideDuration={4000} onClose={() => setSnack({ msg: '' })}>
        <Alert severity={snack.sev || 'success'} onClose={() => setSnack({ msg: '' })}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
