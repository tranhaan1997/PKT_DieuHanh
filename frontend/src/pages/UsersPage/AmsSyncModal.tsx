import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, TextField, InputAdornment,
  Alert, CircularProgress, Tabs, Tab, Tooltip,
} from '@mui/material';
import { SearchOutlined, SyncOutlined, WarningAmberOutlined } from '@mui/icons-material';
import type { ColDef, GridApi, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community';
import api from '../../api/axios';
import DataGrid from '../../components/ui/DataGrid';
import StatusChip from '../../components/ui/StatusChip';
import { StatusCellRenderer, TwoLineCellRenderer } from '../../components/ui/gridCells';
import { palette } from '../../theme/tokens';
import type { StatusKey } from '../../theme/tokens';

export interface AmsOperator {
  USERNAME: string;
  OPER_ID: number;
  DEPT_ID: string;
  DEPT_NAME: string | null;
  DEPT_GROUP: string | null;
  FULLDEPTNAME: string | null;
  EMAIL: string | null;
  OPER_NAME: string;
  MOBILE: string | null;
  POS_NAME: string | null;
  STAT_ID: string;
  EMPLOYEE_CODE: string | null;
  LASTLOGIN: string | null;
  syncStatus: 'new' | 'update' | 'skip' | 'no-email';
}

export interface SyncResult { synced: number; skipped: number; errors: number; }

const STATUS_LABEL: Record<AmsOperator['syncStatus'], string> = {
  update: 'Cần cập nhật', skip: 'Đã đồng bộ', new: 'Chưa đăng nhập', 'no-email': 'Không có email',
};
const STATUS_TONE: Record<AmsOperator['syncStatus'], StatusKey> = {
  update: 'warning', skip: 'success', new: 'info', 'no-email': 'neutral',
};

const TAB_FILTERS: Array<{ label: string; value: AmsOperator['syncStatus'] | 'all' }> = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Cần cập nhật', value: 'update' },
  { label: 'Chưa đăng nhập', value: 'new' },
  { label: 'Đã đồng bộ', value: 'skip' },
  { label: 'Không có email', value: 'no-email' },
];

interface Props { open: boolean; onClose: () => void; onSynced: () => void; }

export default function AmsSyncModal({ open, onClose, onSynced }: Props) {
  const [operators, setOperators]       = useState<AmsOperator[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [tokenMissing, setTokenMissing] = useState(false);
  const [search, setSearch]             = useState('');
  const [tabFilter, setTabFilter]       = useState<AmsOperator['syncStatus'] | 'all'>('all');
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [syncing, setSyncing]           = useState(false);
  const [result, setResult]             = useState<SyncResult | null>(null);

  const gridApiRef = useRef<GridApi<AmsOperator> | null>(null);

  /* Pre-select rows that need updating, mirroring the original behaviour. */
  const applyPreselect = useCallback(() => {
    const api = gridApiRef.current;
    if (!api) return;
    api.forEachNode((n) => n.setSelected(n.data?.syncStatus === 'update'));
  }, []);

  useEffect(() => {
    if (!open) { setLoading(true); setOperators([]); setSelectedUsernames([]); return; }
    setResult(null); setError(''); setSearch(''); setTabFilter('all');
    loadOperators();
  }, [open]);

  useEffect(() => { if (operators.length) applyPreselect(); }, [operators, applyPreselect]);

  const loadOperators = async () => {
    const amsToken = localStorage.getItem('dh_ams_token');
    if (!amsToken) { setTokenMissing(true); setLoading(false); return; }
    setTokenMissing(false); setLoading(true); setError('');
    try {
      const { data } = await api.post<AmsOperator[]>('/api/admin/sync/ams-users/list', { amsToken });
      setOperators(data);
    } catch (err: any) {
      const status = err.response?.status;
      const raw = err.response?.data?.message;
      const msg = typeof raw === 'object' && raw !== null
        ? (typeof raw.message === 'string' ? raw.message : JSON.stringify(raw))
        : (typeof raw === 'string' ? raw : err.message ?? '');
      if (status === 422 || msg.includes('ams_token_expired')) setError('TOKEN_EXPIRED');
      else if (msg.includes('ams_token_missing')) setTokenMissing(true);
      else if (status === 401) setError('TOKEN_EXPIRED');
      else setError(msg || `Lỗi ${status || ''}: Không thể lấy danh sách từ AMS`);
    } finally {
      setLoading(false);
    }
  };

  const onGridReady = (e: GridReadyEvent<AmsOperator>) => { gridApiRef.current = e.api; };
  const onSelectionChanged = (e: SelectionChangedEvent<AmsOperator>) =>
    setSelectedUsernames(e.api.getSelectedRows().map((r) => r.USERNAME));

  const counts = useMemo(() => {
    const c = { update: 0, skip: 0, new: 0, 'no-email': 0 };
    operators.forEach((o) => { c[o.syncStatus]++; });
    return c;
  }, [operators]);

  const filtered = useMemo(() => {
    let list = tabFilter === 'all' ? operators : operators.filter((o) => o.syncStatus === tabFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((o) =>
        o.OPER_NAME.toLowerCase().includes(q) ||
        o.USERNAME.toLowerCase().includes(q) ||
        (o.EMAIL || '').toLowerCase().includes(q) ||
        (o.FULLDEPTNAME || o.DEPT_NAME || '').toLowerCase().includes(q) ||
        (o.DEPT_GROUP || '').toLowerCase().includes(q));
    }
    return list;
  }, [operators, tabFilter, search]);

  const handleSync = async () => {
    const amsToken = localStorage.getItem('dh_ams_token');
    if (!amsToken) { setTokenMissing(true); return; }
    setSyncing(true); setError('');
    try {
      const { data } = await api.post<SyncResult>('/api/admin/sync/ams-users', { amsToken, selectedUsernames });
      setResult(data);
      onSynced();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đồng bộ thất bại');
    } finally {
      setSyncing(false);
    }
  };

  const columnDefs = useMemo<ColDef<AmsOperator>[]>(() => [
    {
      field: 'OPER_NAME', headerName: 'Họ tên', flex: 1.2, minWidth: 160,
      cellRenderer: TwoLineCellRenderer,
      cellRendererParams: { getPrimary: (r: AmsOperator) => r.OPER_NAME, getSecondary: (r: AmsOperator) => r.USERNAME },
    },
    { field: 'EMAIL', headerName: 'Email', flex: 1.3, minWidth: 180, valueFormatter: (p) => p.value || '—' },
    {
      field: 'FULLDEPTNAME', headerName: 'Phòng ban', flex: 1.2, minWidth: 170,
      valueGetter: (p) => p.data?.FULLDEPTNAME || p.data?.DEPT_NAME || '—',
      tooltipValueGetter: (p) => p.data?.FULLDEPTNAME || '',
    },
    { field: 'DEPT_GROUP', headerName: 'Nhóm', flex: 0.7, minWidth: 110, valueFormatter: (p) => p.value || '—' },
    { field: 'POS_NAME', headerName: 'Chức danh', flex: 0.9, minWidth: 130, valueFormatter: (p) => p.value || '—' },
    {
      field: 'STAT_ID', headerName: 'AMS', width: 110, filter: false, sortable: false,
      cellRenderer: StatusCellRenderer,
      cellRendererParams: { toneMap: { ENABLE: 'success' }, labelMap: { ENABLE: 'Hoạt động' }, fallbackTone: 'neutral' },
      valueFormatter: (p) => (p.value === 'ENABLE' ? 'Hoạt động' : 'Khóa'),
    },
    {
      field: 'syncStatus', headerName: 'Trạng thái', width: 150, filter: false,
      cellRenderer: StatusCellRenderer,
      cellRendererParams: { toneMap: STATUS_TONE, labelMap: STATUS_LABEL },
    },
  ], []);

  const selectedCount = selectedUsernames.length;
  const canSync = selectedCount > 0 && !syncing;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      slotProps={{ paper: { sx: { height: '85vh', display: 'flex', flexDirection: 'column' } } }}>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <span>Đồng bộ nhân viên từ AMS</span>
          {operators.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              {counts.update > 0 && <StatusChip label={`Cần cập nhật: ${counts.update}`} tone="warning" size="sm" />}
              {counts.new > 0 && <StatusChip label={`Mới: ${counts.new}`} tone="info" size="sm" />}
              {counts.skip > 0 && <StatusChip label={`Đã đồng bộ: ${counts.skip}`} tone="success" size="sm" />}
            </Box>
          )}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, gap: 1.5, overflow: 'hidden' }}>
        {tokenMissing && (
          <Alert severity="warning" icon={<WarningAmberOutlined />}
            action={<Button color="warning" size="small" onClick={onClose}>Đóng</Button>}>
            Token AMS chưa có. Vui lòng <strong>đăng xuất và đăng nhập lại qua SSO</strong> để lấy token.
          </Alert>
        )}
        {error === 'TOKEN_EXPIRED' && (
          <Alert severity="error" action={<Button color="error" size="small" onClick={onClose}>Đóng</Button>}>
            Token AMS đã hết hạn. Vui lòng <strong>đăng xuất và đăng nhập lại qua SSO</strong> để làm mới.
          </Alert>
        )}
        {error && error !== 'TOKEN_EXPIRED' && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        {result && (
          <Alert severity="success" onClose={() => setResult(null)}>
            Đồng bộ hoàn tất — Cập nhật: <strong>{result.synced}</strong> &nbsp;|&nbsp;
            Bỏ qua: <strong>{result.skipped}</strong>
            {result.errors > 0 && <> &nbsp;|&nbsp; Lỗi: <strong>{result.errors}</strong></>}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={32} /></Box>
        )}

        {!loading && !tokenMissing && error !== 'TOKEN_EXPIRED' && (
          <>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField size="small" placeholder="Tìm theo tên, email, phòng ban…"
                value={search} onChange={(e) => setSearch(e.target.value)}
                slotProps={{ input: { startAdornment: (<InputAdornment position="start"><SearchOutlined sx={{ fontSize: 18, color: palette.text.muted }} /></InputAdornment>) } }}
                sx={{ width: 280 }} />
              <Box sx={{ flex: 1 }} />
              <Tooltip title="Tải lại danh sách" arrow>
                <Button size="small" variant="outlined" onClick={loadOperators} startIcon={<SyncOutlined sx={{ fontSize: 16 }} />}>
                  Tải lại
                </Button>
              </Tooltip>
            </Box>

            <Tabs value={tabFilter} onChange={(_, v) => setTabFilter(v)} sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0, fontSize: '0.8rem' } }}>
              {TAB_FILTERS.map((t) => (
                <Tab key={t.value} value={t.value}
                  label={t.value === 'all' ? `Tất cả (${operators.length})` : `${t.label} (${counts[t.value as AmsOperator['syncStatus']] ?? 0})`} />
              ))}
            </Tabs>

            <DataGrid
              rowData={filtered}
              columnDefs={columnDefs}
              getRowId={(p) => p.data.USERNAME}
              rowHeight={50}
              rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: true, enableClickSelection: false }}
              onGridReady={onGridReady}
              onSelectionChanged={onSelectionChanged}
            />
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Typography sx={{ fontSize: '0.8rem', color: palette.text.muted, flex: 1 }}>
          {selectedCount > 0 ? `Đã chọn ${selectedCount} nhân viên để đồng bộ` : 'Chọn nhân viên cần đồng bộ'}
        </Typography>
        <Button onClick={onClose} disabled={syncing}>Đóng</Button>
        <Button variant="contained" onClick={handleSync} disabled={!canSync}
          startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncOutlined />}>
          {syncing ? 'Đang đồng bộ…' : `Đồng bộ ${selectedCount > 0 ? selectedCount + ' nhân viên' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
