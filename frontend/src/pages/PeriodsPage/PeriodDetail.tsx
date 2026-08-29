import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, Chip, Stack, Autocomplete, TextField,
  CircularProgress, Snackbar, Alert, Paper, Divider, IconButton, Tooltip,
  ToggleButtonGroup, ToggleButton, FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  useTheme, useMediaQuery,
} from '@mui/material';
import {
  ArrowBack, AutoFixHigh, Save, Add,
  DeleteOutlined, FilterList, DeleteSweepOutlined,
  ArrowUpward, ArrowDownward, EditOutlined, CloudDownloadOutlined, SettingsOutlined, CheckCircleOutlined, DragIndicator,
} from '@mui/icons-material';
import { useTopBar } from '../../components/layout/TopBarContext';
import { useAuth } from '../../hooks/useAuth';
import type { ColDef } from 'ag-grid-community';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPeriod, assignSolutions, assignSites, assignSupervisors,
  generateWorkOrders, updatePeriod, updateSolutionSheetConfig, updateSolutionGenCol,
} from '../../api/periods';
import SheetSyncDialog from '../../components/ui/SheetSyncDialog';
import { getSolutions } from '../../api/solutions';
import { getSites } from '../../api/sites';
import { getUsers } from '../../api/users';
import { getWorkOrders, deleteWorkOrder, bulkDeleteWorkOrders, deleteWorkOrdersByLabel } from '../../api/workOrders';
import type { UserOption } from '../../api/users';
import StatusChip from '../../components/ui/StatusChip';
import DataGrid from '../../components/ui/DataGrid';
import MobileList, { MobileCard } from '../../components/ui/MobileList';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { palette, status as statusTones } from '../../theme/tokens';
import type { StatusKey } from '../../theme/tokens';
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Nháp', ACTIVE: 'Đang thực hiện', CLOSED: 'Đóng' };

function colLetterToIndex(letter: string): number {
  const s = letter.trim().toUpperCase();
  let idx = 0;
  for (let i = 0; i < s.length; i++) idx = idx * 26 + (s.charCodeAt(i) - 64);
  return idx - 1;
}
function colIndexToLetter(idx: number): string {
  let n = idx + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const INSTALL_TONE: Record<string, StatusKey> = {
  NOT_STARTED: 'neutral', IN_PROGRESS: 'warning', COMPLETED: 'success', CANCELLED: 'error',
};
const INSTALL_LABEL: Record<string, string> = {
  NOT_STARTED: 'Chưa TH', IN_PROGRESS: 'Đang TH', COMPLETED: 'Hoàn thành', CANCELLED: 'Hủy',
};
const SLA_TONE: Record<string, StatusKey> = {
  'Hoàn thành': 'success', 'Đúng hạn': 'info', 'Sắp quá hạn': 'warning', 'Quá hạn': 'error', 'Đã hủy': 'neutral',
};

const fmtDate = (v: any) => (v ? new Date(v as string).toLocaleDateString('vi-VN') : '—');

interface Props { periodId: number; onBack: () => void; }

function Section({ title, count, children, action }: {
  title: string; count?: number; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{
        px: 2.5, py: 1.5,
        display: 'flex', alignItems: 'center', gap: 1.5,
        bgcolor: palette.cardAlt,
        borderBottom: `1px solid ${palette.border}`,
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: palette.text.primary, flex: 1 }}>
          {title}
          {count !== undefined && (
            <Box component="span" sx={{ ml: 1, px: 1, py: 0.2, borderRadius: 1, bgcolor: palette.brand.soft, color: palette.brand.main, fontSize: '0.75rem', fontWeight: 700 }}>
              {count}
            </Box>
          )}
        </Typography>
        {action}
      </Box>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Paper>
  );
}

const emptyEditForm = {
  periodCode: '', periodName: '', startDate: '', endDate: '',
  googleSheetId: '', googleSheetTab: '', googleSheetStartRow: '', googleSheetSiteCol: '',
};

export default function PeriodDetail({ periodId, onBack }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const canEditRole = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const qc = useQueryClient();
  const { setBack, clearBack } = useTopBar();
  const [snack, setSnack] = useState<{ msg: string; sev?: 'success' | 'error' }>({ msg: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [selectedSupervisors, setSelectedSupervisors] = useState<UserOption[]>([]);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [deleteWoId, setDeleteWoId] = useState<number | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Solution filters
  const [solAssignSearch, setSolAssignSearch] = useState('');
  const [solAddSearch, setSolAddSearch] = useState('');

  // Sites — local buffered state, saved explicitly
  const [assignedSiteIds, setAssignedSiteIds] = useState<Set<number>>(new Set());
  const [sitesDirty, setSitesDirty] = useState(false);
  // assigned grid filters
  const [assignSearch, setAssignSearch] = useState('');
  const [assignProvince, setAssignProvince] = useState('');
  // "add" grid filters + selection
  const [addSearch, setAddSearch] = useState('');
  const [addProvince, setAddProvince] = useState('');
  const [selectedToAdd, setSelectedToAdd] = useState<number[]>([]);
  // assigned grid remove selection
  const [selectedToRemove, setSelectedToRemove] = useState<number[]>([]);
  const [addSitesOpen, setAddSitesOpen] = useState(false);

  // WO selection for bulk delete
  const [selectedWoIds, setSelectedWoIds] = useState<number[]>([]);

  const [sheetSyncOpen, setSheetSyncOpen] = useState(false);

  // WO filters
  const [woSolutionFilter, setWoSolutionFilter] = useState('');
  const [woStatusFilter, setWoStatusFilter] = useState('');
  const [woLabelFilter, setWoLabelFilter] = useState('');
  const [woSearch, setWoSearch] = useState('');
  const MOBILE_WO_PAGE_SIZE = 30;
  const [mobileWoVisibleCount, setMobileWoVisibleCount] = useState(MOBILE_WO_PAGE_SIZE);
  useEffect(() => {
    setMobileWoVisibleCount(MOBILE_WO_PAGE_SIZE);
  }, [woSolutionFilter, woStatusFilter, woLabelFilter, woSearch]);
  const [deleteByLabelConfirm, setDeleteByLabelConfirm] = useState(false);

  const { data: period, isLoading } = useQuery({
    queryKey: ['period', periodId],
    queryFn: () => getPeriod(periodId).then((r) => r.data),
  });
  const isClosed = period?.status === 'CLOSED';
  const canEdit = canEditRole && !isClosed;
  const { data: allSolutions } = useQuery({
    queryKey: ['solutions'],
    queryFn: () => getSolutions().then((r) => r.data),
  });
  const { data: allSitesData } = useQuery({
    queryKey: ['sites-all'],
    queryFn: () => getSites({ limit: '5000' }).then((r) => r.data),
  });
  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers().then((r) => r.data),
  });
  const { data: woData, isLoading: woLoading } = useQuery({
    queryKey: ['period-wos', periodId],
    queryFn: () => getWorkOrders({ periodId: String(periodId), limit: '5000' }).then((r) => r.data),
    enabled: !!period,
  });

  // Sync supervisors
  useEffect(() => {
    if (period?.periodUsers) {
      setSelectedSupervisors(period.periodUsers.map((pu: any) => pu.user as UserOption));
    }
  }, [period?.periodUsers]);

  // Sync assigned sites from period data
  useEffect(() => {
    if (!period?.periodSites) return;
    setAssignedSiteIds(new Set(period.periodSites.map((ps: any) => ps.site.id as number)));
    setSitesDirty(false);
  }, [period?.id, period?.periodSites?.length]);

  // Topbar back (mobile)
  useEffect(() => {
    if (isMobile) {
      setBack(period?.periodName ?? 'Chi tiết kỳ', onBack);
      return () => clearBack();
    }
  }, [isMobile, period?.periodName, onBack, setBack, clearBack]);

  /* ─── Mutations ───────────────────────────────────────────────── */
  const assignSolMutation = useMutation({
    mutationFn: (ids: number[]) => assignSolutions(periodId, ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', periodId] }); setSnack({ msg: 'Đã cập nhật giải pháp' }); },
  });
  const assignSitesMutation = useMutation({
    mutationFn: (ids: number[]) => assignSites(periodId, ids),
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ['period', periodId] });
      setSitesDirty(false);
      setSelectedToAdd([]);
      setSelectedToRemove([]);
      setSnack({ msg: `Đã lưu ${ids.length} trạm` });
    },
  });
  const supervisorMutation = useMutation({
    mutationFn: (userIds: number[]) => assignSupervisors(periodId, userIds),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['period', periodId] }); setSnack({ msg: 'Đã cập nhật nhân sự' }); },
  });
  const generateMutation = useMutation({
    mutationFn: () => generateWorkOrders(periodId).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['period', periodId] });
      qc.invalidateQueries({ queryKey: ['period-wos', periodId] });
      setSnack({ msg: data.message });
    },
    onError: (e: any) => setSnack({ msg: e?.response?.data?.message || 'Lỗi sinh Phiếu thi công', sev: 'error' }),
  });
  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => updatePeriod(periodId, { status } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period', periodId] });
      qc.invalidateQueries({ queryKey: ['periods'] });
      setSnack({ msg: 'Đã cập nhật trạng thái' });
    },
    onError: () => setSnack({ msg: 'Cập nhật thất bại', sev: 'error' }),
  });
  const editMutation = useMutation({
    mutationFn: (data: typeof emptyEditForm) => updatePeriod(periodId, {
      ...data,
      googleSheetStartRow: data.googleSheetStartRow ? Number(data.googleSheetStartRow) : undefined,
    } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period', periodId] });
      qc.invalidateQueries({ queryKey: ['periods'] });
      setEditOpen(false);
      setSnack({ msg: 'Đã cập nhật thông tin kỳ' });
    },
    onError: () => setSnack({ msg: 'Cập nhật thất bại', sev: 'error' }),
  });
  const deleteWoMutation = useMutation({
    mutationFn: (id: number) => deleteWorkOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period-wos', periodId] });
      qc.invalidateQueries({ queryKey: ['period', periodId] });
      setSnack({ msg: 'Đã xóa Phiếu thi công' });
    },
  });
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => bulkDeleteWorkOrders(ids),
    onSuccess: ({ deleted }, ids) => {
      qc.invalidateQueries({ queryKey: ['period-wos', periodId] });
      qc.invalidateQueries({ queryKey: ['period', periodId] });
      setSelectedWoIds([]);
      setSnack({
        msg: deleted < ids.length
          ? `Đã xóa ${deleted} Phiếu thi công, ${ids.length - deleted} không xóa được (đã bị xóa trước đó)`
          : `Đã xóa ${deleted} Phiếu thi công`,
      });
    },
    onError: () => setSnack({ msg: 'Xóa thất bại', sev: 'error' }),
  });
  const deleteByLabelMutation = useMutation({
    mutationFn: (label: string) => deleteWorkOrdersByLabel(label),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['period-wos', periodId] });
      qc.invalidateQueries({ queryKey: ['period', periodId] });
      qc.invalidateQueries({ queryKey: ['wo-labels'] });
      setWoLabelFilter('');
      setDeleteByLabelConfirm(false);
      setSnack({ msg: `Đã xóa ${res.deleted} phiếu thi công` });
    },
    onError: () => setSnack({ msg: 'Xóa thất bại', sev: 'error' }),
  });

  // orderedSolIds: tracks the ordered list of assigned solution IDs (preserves server order)
  const [orderedSolIds, setOrderedSolIds] = useState<number[]>([]);

  useEffect(() => {
    if (!period?.periodSolutions) return;
    setOrderedSolIds(period.periodSolutions.map((ps: any) => ps.solution.id));
  }, [period?.periodSolutions]);

  const assignedSolIds = useMemo(() => new Set(orderedSolIds), [orderedSolIds]);

  const sheetConfigMap = useMemo(() => {
    const m = new Map<number, any>();
    (period?.periodSolutions || []).forEach((ps: any) => m.set(ps.solution.id, ps));
    return m;
  }, [period?.periodSolutions]);
  const emptySheetConfigForm = {
    sheetTab: '', sheetStartRow: '', sheetSiteCol: '', sheetWrittenCol: '', sheetActCol: '',
    sheetTtkvCol: '', sheetSiteRecvCol: '',
    sheetPlanDateCol: '', sheetExecutorCol: '', sheetInstallCol: '', sheetPhotoCol: '',
    sheetIntegrationCol: '', sheetNoteCol: '', sheetIssueCol: '', sheetCompletedDateCol: '',
  };
  const [sheetConfigSolution, setSheetConfigSolution] = useState<{ id: number; name: string } | null>(null);
  const [sheetConfigForm, setSheetConfigForm] = useState(emptySheetConfigForm);
  const saveSheetConfigMutation = useMutation({
    mutationFn: ({ solutionId, config }: { solutionId: number; config: typeof emptySheetConfigForm }) =>
      updateSolutionSheetConfig(periodId, solutionId, {
        sheetTab: config.sheetTab,
        sheetStartRow: config.sheetStartRow ? Number(config.sheetStartRow) : undefined,
        sheetSiteCol: config.sheetSiteCol,
        sheetWrittenCol: config.sheetWrittenCol,
        sheetActCol: config.sheetActCol,
        sheetTtkvCol: config.sheetTtkvCol,
        sheetSiteRecvCol: config.sheetSiteRecvCol,
        sheetPlanDateCol: config.sheetPlanDateCol,
        sheetExecutorCol: config.sheetExecutorCol,
        sheetInstallCol: config.sheetInstallCol,
        sheetPhotoCol: config.sheetPhotoCol,
        sheetIntegrationCol: config.sheetIntegrationCol,
        sheetNoteCol: config.sheetNoteCol,
        sheetIssueCol: config.sheetIssueCol,
        sheetCompletedDateCol: config.sheetCompletedDateCol,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period', periodId] });
      setSheetConfigSolution(null);
      setSnack({ msg: 'Đã lưu cấu hình Sheet' });
    },
    onError: () => setSnack({ msg: 'Lưu cấu hình Sheet thất bại', sev: 'error' }),
  });
  const [genColEdits, setGenColEdits] = useState<Record<number, string>>({});
  const saveGenColMutation = useMutation({
    mutationFn: ({ solutionId, genCol }: { solutionId: number; genCol: string }) =>
      updateSolutionGenCol(periodId, solutionId, genCol),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['period', periodId] });
      setSnack({ msg: 'Đã lưu cột giải pháp' });
    },
    onError: () => setSnack({ msg: 'Lưu cột giải pháp thất bại', sev: 'error' }),
  });

  const assignedSolutions = useMemo(() => {
    const q = solAssignSearch.toLowerCase();
    const solById = new Map((allSolutions || []).map((s) => [s.id, s]));
    return orderedSolIds
      .map((id) => solById.get(id))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .filter((s) => !q || s.solutionName.toLowerCase().includes(q) || s.solutionCode.toLowerCase().includes(q));
  }, [allSolutions, orderedSolIds, solAssignSearch]);

  const unassignedSolutions = useMemo(() => {
    const q = solAddSearch.toLowerCase();
    return (allSolutions || [])
      .filter((s) => s.active && !assignedSolIds.has(s.id))
      .filter((s) => !q || s.solutionName.toLowerCase().includes(q) || s.solutionCode.toLowerCase().includes(q));
  }, [allSolutions, assignedSolIds, solAddSearch]);

  const removeSolution = (id: number) => {
    const updated = orderedSolIds.filter((x) => x !== id);
    setOrderedSolIds(updated);
    assignSolMutation.mutate(updated);
  };

  const addSolution = (id: number) => {
    const updated = [...orderedSolIds, id];
    setOrderedSolIds(updated);
    assignSolMutation.mutate(updated);
  };

  const moveSolution = (id: number, dir: -1 | 1) => {
    const idx = orderedSolIds.indexOf(id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= orderedSolIds.length) return;
    const updated = [...orderedSolIds];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setOrderedSolIds(updated);
    assignSolMutation.mutate(updated);
  };

  const moveSolutionToIndex = (id: number, toIdx: number) => {
    const fromIdx = orderedSolIds.indexOf(id);
    if (fromIdx < 0 || fromIdx === toIdx) return;
    const updated = [...orderedSolIds];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setOrderedSolIds(updated);
    assignSolMutation.mutate(updated);
  };

  const [dragSolId, setDragSolId] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const allSites = useMemo(() => allSitesData?.data || [], [allSitesData]);

  const siteProvinces = useMemo(
    () => Array.from(new Set(allSites.map((s: any) => s.province).filter(Boolean))).sort() as string[],
    [allSites],
  );

  // Sites already assigned to this period
  const assignedSites = useMemo(
    () => allSites.filter((s: any) => assignedSiteIds.has(s.id)),
    [allSites, assignedSiteIds],
  );

  // Sites NOT yet assigned (candidates to add)
  const unassignedSites = useMemo(
    () => allSites.filter((s: any) => !assignedSiteIds.has(s.id)),
    [allSites, assignedSiteIds],
  );

  const filteredAssigned = useMemo(() => assignedSites.filter((s: any) => {
    if (assignProvince && s.province !== assignProvince) return false;
    if (assignSearch) {
      const q = assignSearch.toLowerCase();
      if (!s.siteCode?.toLowerCase().includes(q) && !s.siteName?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [assignedSites, assignSearch, assignProvince]);

  const filteredUnassigned = useMemo(() => unassignedSites.filter((s: any) => {
    if (addProvince && s.province !== addProvince) return false;
    if (addSearch) {
      const q = addSearch.toLowerCase();
      if (!s.siteCode?.toLowerCase().includes(q) && !s.siteName?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [unassignedSites, addSearch, addProvince]);

  const woLabels = useMemo(() => {
    const s = new Set<string>();
    (woData?.data || []).forEach((wo) => { if (wo.label) s.add(wo.label); });
    return Array.from(s).sort().reverse();
  }, [woData]);

  const filteredWOs = useMemo(() => {
    const all = woData?.data || [];
    return all.filter((wo) => {
      if (woSolutionFilter && wo.solutionId !== Number(woSolutionFilter)) return false;
      if (woStatusFilter && wo.installationStatus !== woStatusFilter) return false;
      if (woLabelFilter && wo.label !== woLabelFilter) return false;
      if (woSearch) {
        const q = woSearch.toLowerCase();
        if (
          !wo.ticketNo.toLowerCase().includes(q) &&
          !wo.site?.siteCode?.toLowerCase().includes(q) &&
          !wo.site?.siteName?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [woData, woSolutionFilter, woStatusFilter, woLabelFilter, woSearch]);

  /* ─── Column defs ─────────────────────────────────────────────── */
  const siteColDefs = useMemo<ColDef[]>(() => [
    { field: 'siteCode', headerName: 'Mã trạm', width: 130 },
    { field: 'siteName', headerName: 'Tên trạm', flex: 1, minWidth: 180 },
    { field: 'province', headerName: 'Tỉnh/Thành', width: 130 },
    { field: 'district', headerName: 'Quận/Huyện', width: 130 },
    { field: 'ttkvCode', headerName: 'TTKV', width: 100 },
    { field: 'siteType', headerName: 'Loại trạm', width: 110 },
  ], []);

  const assignedSiteColDefs = useMemo<ColDef[]>(() => [
    { field: 'siteCode', headerName: 'Mã trạm', width: 130 },
    { field: 'siteName', headerName: 'Tên trạm', flex: 1, minWidth: 180 },
    { field: 'province', headerName: 'Tỉnh/Thành', width: 130 },
    { field: 'district', headerName: 'Quận/Huyện', width: 130 },
    { field: 'ttkvCode', headerName: 'TTKV', width: 100 },
    { field: 'siteType', headerName: 'Loại trạm', width: 110 },
    ...(canEdit ? [{
      headerName: '', width: 52, pinned: 'right' as const, sortable: false, filter: false, resizable: false,
      cellRenderer: ({ data }: any) => (
        <Tooltip title="Xóa khỏi kỳ" arrow>
          <IconButton size="small"
            onClick={() => {
              const next = new Set(assignedSiteIds);
              next.delete(data.id);
              setAssignedSiteIds(next);
              setSitesDirty(true);
            }}
            sx={{ color: palette.text.muted, '&:hover': { color: statusTones.error.solid } }}>
            <DeleteOutlined sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      ),
    }] : []),
  ], [assignedSiteIds, canEdit]);

  const woColDefs = useMemo<ColDef[]>(() => [
    { field: 'ticketNo', headerName: 'Ticket No', width: 160, pinned: 'left' },
    { field: 'site.siteCode', headerName: 'Mã trạm', width: 120 },
    { field: 'site.siteName', headerName: 'Tên trạm', flex: 1, minWidth: 160 },
    { field: 'site.province', headerName: 'Tỉnh', width: 120 },
    { field: 'solution.solutionName', headerName: 'Giải pháp', width: 180 },
    {
      field: 'installationStatus', headerName: 'Trạng thái', width: 130,
      cellRenderer: ({ value }: any) => (
        <StatusChip label={INSTALL_LABEL[value] ?? value} tone={INSTALL_TONE[value] ?? 'neutral'} />
      ),
    },
    { field: 'planDate', headerName: 'KH thực hiện', width: 130, valueFormatter: (p) => fmtDate(p.value) },
    { field: 'executorName', headerName: 'Nhân sự TH', width: 140 },
    { field: 'createdAt', headerName: 'Ngày tạo', width: 110, valueFormatter: (p) => fmtDate(p.value) },
    ...(canEdit ? [{
      headerName: '', width: 56, pinned: 'right' as const, sortable: false, filter: false, resizable: false,
      cellRenderer: ({ data }: any) => (
        <Tooltip title="Xóa" arrow>
          <IconButton size="small" onClick={() => setDeleteWoId(data.id)}
            sx={{ color: palette.text.muted, '&:hover': { color: statusTones.error.solid } }}>
            <DeleteOutlined sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      ),
    }] : []),
  ], [canEdit]);

  if (isLoading || !period) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  const workOrders = woData?.data || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {isClosed && (
        <Alert severity="warning" sx={{ fontSize: '0.82rem' }}>
          Kỳ đã đóng — chỉ xem, không thể sinh phiếu, cập nhật phiếu, đồng bộ hoặc thay đổi cấu hình. Chuyển trạng thái về "Đang thực hiện" nếu cần chỉnh sửa lại.
        </Alert>
      )}

      {/* ── Header ───────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Row 1: breadcrumb — desktop only */}
        {!isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Button startIcon={<ArrowBack />} onClick={onBack} size="small" sx={{ color: palette.text.secondary }}>
              Kỳ thực hiện
            </Button>
            <Typography sx={{ color: palette.text.faint }}>/</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: palette.text.primary }}>
              {period.periodName}
            </Typography>
            <Chip label={period.periodCode} size="small"
              sx={{ bgcolor: palette.brand.soft, color: palette.brand.main, fontWeight: 600, fontSize: '0.75rem' }} />
          </Box>
        )}
        {/* Row 2: actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            value={period.status} exclusive size="small"
            onChange={(_, v) => { if (v && v !== period.status) setPendingStatus(v); }}
            sx={{
              gap: 0.5, bgcolor: 'transparent', border: 'none',
              '& .MuiToggleButton-root': {
                px: { xs: 1, md: 1.75 }, py: 0.5, fontSize: '0.75rem', fontWeight: 600,
                textTransform: 'none', borderRadius: '6px !important',
                border: `1px solid ${palette.border} !important`,
                color: palette.text.secondary,
                '&.Mui-selected': { color: '#fff' },
              },
              '& .MuiToggleButton-root[value="DRAFT"].Mui-selected':  { bgcolor: '#64748B', borderColor: '#64748B !important' },
              '& .MuiToggleButton-root[value="ACTIVE"].Mui-selected': { bgcolor: palette.brand.main, borderColor: `${palette.brand.main} !important` },
              '& .MuiToggleButton-root[value="CLOSED"].Mui-selected': { bgcolor: '#16A34A', borderColor: '#16A34A !important' },
            }}
          >
            <ToggleButton value="DRAFT">Nháp</ToggleButton>
            <ToggleButton value="ACTIVE">{isMobile ? 'Đang TH' : 'Đang thực hiện'}</ToggleButton>
            <ToggleButton value="CLOSED">Đóng</ToggleButton>
          </ToggleButtonGroup>

          <Tooltip title={isClosed ? 'Kỳ đã đóng — không thể sinh phiếu' : ''} arrow>
            <span>
              <Button variant="outlined" startIcon={<CloudDownloadOutlined />} size="small"
                disabled={isClosed}
                onClick={() => setSheetSyncOpen(true)}>
                {isMobile ? 'Sync Sheet' : 'Đồng bộ từ Google Sheet'}
              </Button>
            </span>
          </Tooltip>

          {canEdit && (
            <Tooltip
              title={!orderedSolIds.length || !assignedSiteIds.size ? 'Cần gán ít nhất 1 giải pháp và 1 trạm' : ''}
              arrow
            >
              <span>
                <Button variant="contained" startIcon={<AutoFixHigh />} size="small" color="success"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending || !orderedSolIds.length || !assignedSiteIds.size}>
                  {generateMutation.isPending ? 'Đang sinh...' : (isMobile ? 'Sinh phiếu' : 'Sinh Phiếu thi công')}
                </Button>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* ── Info card ────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ borderRadius: 2, p: { xs: 1.75, md: 2.5 } }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 2, md: 4 }, flexWrap: 'wrap' }}>
          {/* Metadata */}
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: palette.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Thông tin kỳ
              </Typography>
              <Button size="small" startIcon={<EditOutlined sx={{ fontSize: 14 }} />} disabled={isClosed}
                onClick={() => {
                  setEditForm({
                    periodCode: period.periodCode,
                    periodName: period.periodName,
                    startDate: period.startDate?.substring(0, 10) ?? '',
                    endDate: period.endDate?.substring(0, 10) ?? '',
                    googleSheetId: period.googleSheetId ?? '',
                    googleSheetTab: period.googleSheetTab ?? '',
                    googleSheetStartRow: period.googleSheetStartRow ? String(period.googleSheetStartRow) : '',
                    googleSheetSiteCol: period.googleSheetSiteCol ?? '',
                  });
                  setEditOpen(true);
                }}
                sx={{ fontSize: '0.75rem', py: 0.25 }}>
                Sửa
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                { label: 'Mã kỳ', value: period.periodCode },
                { label: 'Ngày bắt đầu', value: fmtDate(period.startDate) },
                { label: 'Ngày kết thúc', value: fmtDate(period.endDate) },
                { label: 'Người tạo', value: period.createdBy?.fullName || '—' },
              ].map((r) => (
                <Box key={r.label} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                  <Typography sx={{ fontSize: '0.8rem', color: palette.text.muted, width: 110, flexShrink: 0 }}>{r.label}</Typography>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: palette.text.primary }}>{r.value}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Divider orientation={isMobile ? 'horizontal' : 'vertical'} flexItem />

          {/* Stats */}
          <Box sx={{ display: 'flex', gap: { xs: 3, md: 2.5 }, alignItems: 'flex-start' }}>
            {[
              { label: 'Giải pháp', value: period._count?.periodSolutions ?? 0, tone: palette.brand.main },
              { label: 'Trạm', value: period.siteCount ?? period._count?.periodSites ?? 0, tone: palette.accent.main },
              { label: 'Phiếu TC', value: period._count?.workOrders ?? 0, tone: statusTones.success.solid },
            ].map((s) => (
              <Box key={s.label} sx={{ textAlign: 'center', minWidth: 60 }}>
                <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' }, fontWeight: 800, color: s.tone, lineHeight: 1 }}>{s.value}</Typography>
                <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted, mt: 0.25 }}>{s.label}</Typography>
              </Box>
            ))}
          </Box>

          <Divider orientation={isMobile ? 'horizontal' : 'vertical'} flexItem />

          {/* Supervisors */}
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: palette.text.secondary, mb: 1 }}>
              Nhân sự điều hành
            </Typography>
            <Autocomplete<UserOption, true, false, false>
              multiple size="small"
              options={allUsers || []}
              value={selectedSupervisors}
              onChange={(_, v) => setSelectedSupervisors(v)}
              getOptionLabel={(o) => o.fullName}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ flexDirection: 'column', alignItems: 'flex-start !important' }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>{option.fullName}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: palette.text.muted }}>
                    {option.department || '—'} · {option.username}
                  </Typography>
                </Box>
              )}
              renderValue={(value, getItemProps) =>
                value.map((option, index) => {
                  const { key, ...itemProps } = getItemProps({ index });
                  return (
                    <Chip key={key} {...itemProps} size="small"
                      label={option.department ? `${option.fullName} · ${option.department}` : option.fullName} />
                  );
                })
              }
              renderInput={(params) => (
                <TextField {...params} placeholder={selectedSupervisors.length ? '' : 'Chọn nhân sự...'} />
              )}
            />
            {canEdit && (
              <Button size="small" variant="outlined" startIcon={<Save />} sx={{ mt: 1 }}
                disabled={supervisorMutation.isPending}
                onClick={() => supervisorMutation.mutate(selectedSupervisors.map((u) => u.id))}>
                Lưu nhân sự
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* ── Giải pháp ────────────────────────────────────────────── */}
      <Section title="Giải pháp" count={assignedSolIds.size}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          {/* — Assigned — */}
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: palette.text.muted, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 1 }}>
              Đã gán ({(allSolutions || []).filter((s) => assignedSolIds.has(s.id)).length})
            </Typography>
            <TextField size="small" fullWidth placeholder="Tìm giải pháp đã gán..."
              value={solAssignSearch} onChange={(e) => setSolAssignSearch(e.target.value)}
              sx={{ mb: 1.5 }} />
            {assignedSolutions.length === 0 ? (
              <Typography sx={{ fontSize: '0.8125rem', color: palette.text.faint, fontStyle: 'italic' }}>Chưa có giải pháp nào</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {assignedSolutions.map((sol, idx) => (
                  <Box key={sol.id}
                    draggable={canEdit}
                    onDragStart={() => canEdit && setDragSolId(sol.id)}
                    onDragOver={(e) => { if (!canEdit) return; e.preventDefault(); setDragOverIdx(idx); }}
                    onDragEnd={() => { setDragSolId(null); setDragOverIdx(null); }}
                    onDrop={(e) => {
                      if (!canEdit) return;
                      e.preventDefault();
                      if (dragSolId !== null) moveSolutionToIndex(dragSolId, idx);
                      setDragSolId(null);
                      setDragOverIdx(null);
                    }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      px: 1.25, py: 0.5, borderRadius: 1.5,
                      border: `1.5px solid ${palette.brand.main}`,
                      bgcolor: palette.brand.soft,
                      opacity: dragSolId === sol.id ? 0.4 : 1,
                      outline: dragOverIdx === idx && dragSolId !== sol.id ? `2px dashed ${palette.brand.main}` : 'none',
                      transition: 'opacity 0.15s',
                    }}>
                    {canEdit && (
                      <Box sx={{ cursor: 'grab', display: 'flex', color: palette.text.faint, '&:active': { cursor: 'grabbing' } }}>
                        <DragIndicator sx={{ fontSize: 18 }} />
                      </Box>
                    )}
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: palette.brand.main, minWidth: 18, textAlign: 'center' }}>
                      {idx + 1}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: palette.brand.main, lineHeight: 1.3 }} noWrap>
                        {sol.solutionName}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '0.68rem', color: palette.text.muted }}>
                          {sol.solutionCode}
                        </Typography>
                        {sheetConfigMap.get(sol.id)?.sheetTab && (
                          <Chip
                            icon={<CheckCircleOutlined sx={{ fontSize: 12 }} />}
                            label={sheetConfigMap.get(sol.id)?.sheetTab}
                            size="small"
                            sx={{
                              height: 18, fontSize: '0.62rem', fontWeight: 600,
                              bgcolor: `${statusTones.success.solid}15`, color: statusTones.success.solid,
                              '& .MuiChip-icon': { color: statusTones.success.solid, ml: 0.5 },
                              '& .MuiChip-label': { px: 0.6 },
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                    {canEdit && (
                      <Tooltip title={sheetConfigMap.get(sol.id)?.sheetTab ? `Sheet: ${sheetConfigMap.get(sol.id)?.sheetTab}` : 'Chưa cấu hình Sheet'} arrow>
                        <IconButton size="small"
                          onClick={() => {
                            const cfg = sheetConfigMap.get(sol.id);
                            setSheetConfigForm({
                              sheetTab: cfg?.sheetTab ?? '',
                              sheetStartRow: cfg?.sheetStartRow ? String(cfg.sheetStartRow) : '',
                              sheetSiteCol: cfg?.sheetSiteCol ?? '',
                              sheetWrittenCol: cfg?.sheetWrittenCol ?? '',
                              sheetActCol: cfg?.sheetActCol ?? '',
                              sheetTtkvCol: cfg?.sheetTtkvCol ?? '',
                              sheetSiteRecvCol: cfg?.sheetSiteRecvCol ?? '',
                              sheetPlanDateCol: cfg?.sheetPlanDateCol ?? '',
                              sheetExecutorCol: cfg?.sheetExecutorCol ?? '',
                              sheetInstallCol: cfg?.sheetInstallCol ?? '',
                              sheetPhotoCol: cfg?.sheetPhotoCol ?? '',
                              sheetIntegrationCol: cfg?.sheetIntegrationCol ?? '',
                              sheetNoteCol: cfg?.sheetNoteCol ?? '',
                              sheetIssueCol: cfg?.sheetIssueCol ?? '',
                              sheetCompletedDateCol: cfg?.sheetCompletedDateCol ?? '',
                            });
                            setSheetConfigSolution({ id: sol.id, name: sol.solutionName });
                          }}
                          sx={{ p: 0.4, color: sheetConfigMap.get(sol.id)?.sheetTab ? palette.brand.main : palette.text.muted, bgcolor: 'white' }}>
                          <SettingsOutlined sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canEdit && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        <IconButton size="small" disabled={assignSolMutation.isPending || idx === 0}
                          onClick={() => moveSolution(sol.id, -1)}
                          sx={{ p: 0.15, color: idx === 0 ? palette.text.faint : palette.brand.main }}>
                          <ArrowUpward sx={{ fontSize: 13 }} />
                        </IconButton>
                        <IconButton size="small" disabled={assignSolMutation.isPending || idx === assignedSolutions.length - 1}
                          onClick={() => moveSolution(sol.id, 1)}
                          sx={{ p: 0.15, color: idx === assignedSolutions.length - 1 ? palette.text.faint : palette.brand.main }}>
                          <ArrowDownward sx={{ fontSize: 13 }} />
                        </IconButton>
                      </Box>
                    )}
                    {canEdit && (
                      <Tooltip title="Xóa khỏi kỳ" arrow>
                        <IconButton size="small" disabled={assignSolMutation.isPending}
                          onClick={() => removeSolution(sol.id)}
                          sx={{ p: 0.4, color: palette.text.muted, '&:hover': { color: statusTones.error.solid } }}>
                          <DeleteOutlined sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {canEdit && <Divider orientation={isMobile ? 'horizontal' : 'vertical'} flexItem />}

          {/* — Add — */}
          {canEdit && (
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: palette.text.muted, textTransform: 'uppercase', letterSpacing: '0.04em', mb: 1 }}>
              Chưa gán ({(allSolutions || []).filter((s) => s.active && !assignedSolIds.has(s.id)).length})
            </Typography>
            <TextField size="small" fullWidth placeholder="Tìm giải pháp để thêm..."
              value={solAddSearch} onChange={(e) => setSolAddSearch(e.target.value)}
              sx={{ mb: 1.5 }} />
            {unassignedSolutions.length === 0 ? (
              <Typography sx={{ fontSize: '0.8125rem', color: palette.text.faint, fontStyle: 'italic' }}>Tất cả giải pháp đã được gán</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {unassignedSolutions.map((sol) => (
                  <Box key={sol.id} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 1.5, py: 0.75, borderRadius: 1.5, cursor: 'pointer',
                    border: `1.5px solid ${palette.border}`,
                    bgcolor: palette.card,
                    transition: 'all 0.12s ease',
                    '&:hover': { borderColor: palette.brand.main, bgcolor: palette.brand.soft },
                  }} onClick={() => !assignSolMutation.isPending && addSolution(sol.id)}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500, color: palette.text.primary, lineHeight: 1.3 }}>
                        {sol.solutionName}
                      </Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted }}>
                        {sol.solutionCode}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: palette.brand.main, fontWeight: 600 }}>+ Thêm</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
          )}
        </Box>
      </Section>

      {/* ── Trạm ─────────────────────────────────────────────────── */}
      <Section
        title="Danh sách trạm trong kỳ"
        count={assignedSiteIds.size}
        action={
          canEdit ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              {sitesDirty && <Typography sx={{ fontSize: '0.75rem', color: statusTones.warning.fg }}>Chưa lưu</Typography>}
              <Button size="small" variant="outlined" startIcon={<Add />}
                onClick={() => { setAddSearch(''); setAddProvince(''); setSelectedToAdd([]); setAddSitesOpen(true); }}>
                Thêm trạm
              </Button>
              <Button size="small" variant={sitesDirty ? 'contained' : 'outlined'} startIcon={<Save />}
                disabled={assignSitesMutation.isPending || !sitesDirty}
                onClick={() => assignSitesMutation.mutate(Array.from(assignedSiteIds))}>
                Lưu
              </Button>
            </Stack>
          ) : undefined
        }
      >
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5, alignItems: 'center' }}>
          <FilterList sx={{ fontSize: 18, color: palette.text.muted }} />
          <TextField size="small" placeholder="Tìm trong danh sách..."
            value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} sx={{ width: { xs: '100%', sm: 220 } }} />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Tỉnh/Thành</InputLabel>
            <Select value={assignProvince} label="Tỉnh/Thành" onChange={(e) => setAssignProvince(e.target.value)}>
              <MenuItem value="">Tất cả</MenuItem>
              {siteProvinces.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
          {canEdit && selectedToRemove.length > 0 && (
            <Button size="small" color="error" variant="contained" startIcon={<DeleteOutlined />}
              onClick={() => {
                const next = new Set(assignedSiteIds);
                selectedToRemove.forEach((id) => next.delete(id));
                setAssignedSiteIds(next);
                setSitesDirty(true);
                setSelectedToRemove([]);
              }}>
              Xóa {selectedToRemove.length} trạm
            </Button>
          )}
        </Box>

        {isMobile ? (
          <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
            <MobileList count={filteredAssigned.length}>
              {filteredAssigned.map((site: any) => (
                <MobileCard
                  key={site.id}
                  title={site.siteCode}
                  subtitle={site.siteName}
                  meta={[site.province, site.ttkvCode].filter(Boolean).join(' · ')}
                  onDelete={canEdit ? () => {
                    const next = new Set(assignedSiteIds);
                    next.delete(site.id);
                    setAssignedSiteIds(next);
                    setSitesDirty(true);
                  } : undefined}
                />
              ))}
            </MobileList>
          </Box>
        ) : (
          <DataGrid
            height={320}
            rowData={filteredAssigned}
            columnDefs={assignedSiteColDefs}
            {...(canEdit ? {
              rowSelection: { mode: 'multiRow', checkboxes: true, headerCheckbox: true, enableClickSelection: false },
              onSelectionChanged: (e: any) => setSelectedToRemove(e.api.getSelectedNodes().map((n: any) => n.data.id as number)),
            } : {})}
            pagination
            paginationPageSize={100}
            paginationPageSizeSelector={[50, 100, 200, 500]}
          />
        )}
      </Section>

      {/* ── Dialog: Thêm trạm ────────────────────────────────────── */}
      <Dialog open={addSitesOpen} onClose={() => setAddSitesOpen(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ pb: 1 }}>
          Thêm trạm vào kỳ
          {selectedToAdd.length > 0 && (
            <Box component="span" sx={{ ml: 1.5, px: 1, py: 0.25, borderRadius: 1, bgcolor: palette.brand.soft, color: palette.brand.main, fontSize: '0.8rem', fontWeight: 700 }}>
              {selectedToAdd.length} đã chọn
            </Box>
          )}
        </DialogTitle>
        <Box sx={{ px: 3, pb: 1.5, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField size="small" placeholder="Tìm mã trạm, tên trạm..." autoFocus
            value={addSearch} onChange={(e) => setAddSearch(e.target.value)} sx={{ width: 260 }} />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Tỉnh/Thành</InputLabel>
            <Select value={addProvince} label="Tỉnh/Thành" onChange={(e) => setAddProvince(e.target.value)}>
              <MenuItem value="">Tất cả</MenuItem>
              {siteProvinces.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
          <Typography sx={{ fontSize: '0.8125rem', color: palette.text.muted, ml: 'auto' }}>
            {filteredUnassigned.length} trạm chưa có trong kỳ
          </Typography>
        </Box>
        <DialogContent sx={{ px: { xs: 2, md: 3 }, py: 0 }}>
          {isMobile ? (
            <MobileList count={filteredUnassigned.length}>
              {filteredUnassigned.map((site: any) => {
                const selected = selectedToAdd.includes(site.id);
                return (
                  <Box key={site.id}
                    onClick={() => setSelectedToAdd((prev) => selected ? prev.filter((id) => id !== site.id) : [...prev, site.id])}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      px: 1.5, py: 1, borderRadius: 1.5, cursor: 'pointer',
                      border: `1.5px solid ${selected ? palette.brand.main : palette.border}`,
                      bgcolor: selected ? palette.brand.soft : palette.card,
                      transition: 'all 0.12s',
                    }}>
                    <Box sx={{
                      width: 18, height: 18, borderRadius: '4px', flexShrink: 0,
                      border: `2px solid ${selected ? palette.brand.main : palette.border}`,
                      bgcolor: selected ? palette.brand.main : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selected && <Box sx={{ width: 8, height: 8, bgcolor: '#fff', borderRadius: '2px' }} />}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: palette.text.primary }}>{site.siteCode}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: palette.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.siteName}</Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted }}>{[site.province, site.ttkv].filter(Boolean).join(' · ')}</Typography>
                    </Box>
                  </Box>
                );
              })}
            </MobileList>
          ) : (
            <DataGrid
              height={420}
              rowData={filteredUnassigned}
              columnDefs={siteColDefs}
              rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: true, enableClickSelection: false }}
              onSelectionChanged={(e) => setSelectedToAdd(e.api.getSelectedNodes().map((n) => n.data.id as number))}
              pagination
              paginationPageSize={100}
              paginationPageSizeSelector={[50, 100, 200, 500]}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setAddSitesOpen(false)}>Hủy</Button>
          <Button variant="contained" disabled={selectedToAdd.length === 0}
            onClick={() => {
              const next = new Set(assignedSiteIds);
              selectedToAdd.forEach((id) => next.add(id));
              setAssignedSiteIds(next);
              setSitesDirty(true);
              setSelectedToAdd([]);
              setAddSitesOpen(false);
            }}>
            Thêm {selectedToAdd.length > 0 ? `${selectedToAdd.length} ` : ''}trạm vào kỳ
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Phiếu thi công ──────────────────────────────────────────── */}
      <Section
        title="Phiếu thi công"
        count={workOrders.length}
        action={
          selectedWoIds.length > 0 ? (
            <Button size="small" variant="contained" color="error"
              startIcon={<DeleteSweepOutlined />}
              onClick={() => setBulkDeleteConfirm(true)}>
              Xóa {selectedWoIds.length} WO đã chọn
            </Button>
          ) : (
            <Typography sx={{ fontSize: '0.75rem', color: palette.text.muted }}>
              {filteredWOs.length !== workOrders.length
                ? `Hiển thị ${filteredWOs.length} / ${workOrders.length}`
                : `${workOrders.length} Phiếu thi công`}
            </Typography>
          )
        }
      >
        {/* Filter toolbar */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5, alignItems: 'center' }}>
          <FilterList sx={{ fontSize: 18, color: palette.text.muted }} />
          <TextField size="small" placeholder="Tìm ticket / mã trạm / tên trạm..."
            value={woSearch} onChange={(e) => setWoSearch(e.target.value)} sx={{ width: { xs: '100%', sm: 260 } }} />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Giải pháp</InputLabel>
            <Select value={woSolutionFilter} label="Giải pháp"
              onChange={(e) => setWoSolutionFilter(e.target.value)}>
              <MenuItem value="">Tất cả</MenuItem>
              {(period.periodSolutions || []).map((ps: any) => (
                <MenuItem key={ps.solution.id} value={ps.solution.id}>{ps.solution.solutionName}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Trạng thái</InputLabel>
            <Select value={woStatusFilter} label="Trạng thái"
              onChange={(e) => setWoStatusFilter(e.target.value)}>
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="NOT_STARTED">Chưa TH</MenuItem>
              <MenuItem value="IN_PROGRESS">Đang TH</MenuItem>
              <MenuItem value="COMPLETED">Hoàn thành</MenuItem>
            </Select>
          </FormControl>
          {woLabels.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Lần sinh phiếu</InputLabel>
              <Select value={woLabelFilter} label="Lần sinh phiếu"
                onChange={(e) => setWoLabelFilter(e.target.value)}>
                <MenuItem value="">Tất cả</MenuItem>
                {woLabels.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          {(woSearch || woSolutionFilter || woStatusFilter || woLabelFilter) && (
            <Button size="small" onClick={() => {
              setWoSearch(''); setWoSolutionFilter(''); setWoStatusFilter(''); setWoLabelFilter('');
            }}>Xóa bộ lọc</Button>
          )}
          {canEdit && woLabelFilter && (
            <Button size="small" color="error" variant="outlined" startIcon={<DeleteSweepOutlined />}
              onClick={() => setDeleteByLabelConfirm(true)}>
              Xóa {filteredWOs.length} phiếu của lần này
            </Button>
          )}
        </Box>

        {woLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : workOrders.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ color: palette.text.muted, mb: 0.5 }}>Chưa có Phiếu thi công nào.</Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: palette.text.faint }}>
              Hãy gán giải pháp + trạm, sau đó bấm "Sinh Phiếu thi công".
            </Typography>
          </Box>
        ) : isMobile ? (
          <>
            <MobileList count={filteredWOs.length}>
              {filteredWOs.slice(0, mobileWoVisibleCount).map((wo) => (
                <MobileCard
                  key={wo.id}
                  title={wo.ticketNo}
                  subtitle={`${wo.site?.siteCode} · ${wo.solution?.solutionName}`}
                  meta={[wo.site?.siteName, wo.site?.province].filter(Boolean).join(' · ')}
                  chips={[
                    { label: INSTALL_LABEL[wo.installationStatus] ?? wo.installationStatus, tone: INSTALL_TONE[wo.installationStatus] ?? 'neutral' },
                    { label: wo.slaStatus ?? 'Đúng hạn', tone: SLA_TONE[wo.slaStatus ?? ''] ?? 'neutral' },
                  ]}
                  onDelete={canEdit ? () => setDeleteWoId(wo.id) : undefined}
                >
                  {wo.executorName && (
                    <Typography sx={{ fontSize: '0.75rem', color: palette.text.muted }}>
                      Nhân sự: {wo.executorName}
                    </Typography>
                  )}
                </MobileCard>
              ))}
            </MobileList>
            {filteredWOs.length > mobileWoVisibleCount && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <Button size="small" variant="outlined"
                  onClick={() => setMobileWoVisibleCount((c) => c + MOBILE_WO_PAGE_SIZE)}>
                  Xem thêm ({filteredWOs.length - mobileWoVisibleCount} phiếu)
                </Button>
              </Box>
            )}
          </>
        ) : (
          <DataGrid
            height={500}
            rowData={filteredWOs}
            columnDefs={woColDefs}
            {...(canEdit ? {
              rowSelection: { mode: 'multiRow', checkboxes: true, headerCheckbox: true, enableClickSelection: false },
              onSelectionChanged: (e: any) => setSelectedWoIds(e.api.getSelectedNodes().map((n: any) => n.data.id as number)),
            } : {})}
            pagination
            paginationPageSize={100}
            paginationPageSizeSelector={[50, 100, 200, 500]}
          />
        )}
      </Section>

      {/* ── Confirm: đổi trạng thái ──────────────────────────────── */}
      <ConfirmDialog
        open={pendingStatus !== null}
        title="Xác nhận chuyển trạng thái"
        message={`Chuyển kỳ "${period.periodName}" sang trạng thái "${STATUS_LABEL[pendingStatus ?? ''] ?? pendingStatus}"?`}
        onConfirm={() => { if (pendingStatus) updateStatusMutation.mutate(pendingStatus); setPendingStatus(null); }}
        onClose={() => setPendingStatus(null)}
      />

      {/* ── Confirm: xóa 1 WO ────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteWoId !== null}
        title="Xóa Phiếu thi công"
        message="Phiếu thi công này sẽ bị xóa vĩnh viễn. Tiếp tục?"
        onConfirm={() => { if (deleteWoId) deleteWoMutation.mutate(deleteWoId); setDeleteWoId(null); }}
        onClose={() => setDeleteWoId(null)}
      />

      {/* ── Confirm: xóa hàng loạt WO ────────────────────────────── */}
      <ConfirmDialog
        open={bulkDeleteConfirm}
        title="Xóa hàng loạt Phiếu thi công"
        message={`Xóa ${selectedWoIds.length} Phiếu thi công đã chọn? Hành động này không thể hoàn tác.`}
        onConfirm={() => { bulkDeleteMutation.mutate(selectedWoIds); setBulkDeleteConfirm(false); }}
        onClose={() => setBulkDeleteConfirm(false)}
      />

      {/* ── Confirm: xóa theo lần sinh phiếu (label) ─────────────── */}
      <ConfirmDialog
        open={deleteByLabelConfirm}
        title="Xóa theo lần sinh phiếu"
        message={`Xóa toàn bộ ${filteredWOs.length} phiếu thi công thuộc nhãn "${woLabelFilter}"? Hành động này không thể hoàn tác.`}
        onConfirm={() => deleteByLabelMutation.mutate(woLabelFilter)}
        onClose={() => setDeleteByLabelConfirm(false)}
      />

      {/* ── Sheet config dialog (per solution) ──────────────────── */}
      <Dialog open={!!sheetConfigSolution} onClose={() => setSheetConfigSolution(null)} maxWidth="sm" fullWidth fullScreen={isMobile}
        slotProps={{ paper: { sx: { maxHeight: isMobile ? '100%' : 'calc(100vh - 96px)' } } }}>
        <DialogTitle>Cấu hình Sheet — {sheetConfigSolution?.name}</DialogTitle>
        <DialogContent dividers sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField label="Tên tab Sheet" size="small" sx={{ flex: 2, minWidth: 160 }}
                value={sheetConfigForm.sheetTab}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetTab: e.target.value }))}
                placeholder="Lắp đặt Converter" />
              <TextField label="Bắt đầu từ dòng" size="small" type="number" sx={{ flex: 1, minWidth: 120 }}
                value={sheetConfigForm.sheetStartRow}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetStartRow: e.target.value }))}
                placeholder="6" />
            </Box>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: palette.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Cột phiếu &amp; vật tư
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
              <TextField label="Cột Mã trạm" size="small"
                value={sheetConfigForm.sheetSiteCol}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetSiteCol: e.target.value.toUpperCase() }))}
                placeholder="D" />
              <TextField label="Cột Viết phiếu" size="small"
                value={sheetConfigForm.sheetWrittenCol}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetWrittenCol: e.target.value.toUpperCase() }))}
                placeholder="G" />
              <TextField label="Cột ACT nhận VT" size="small"
                value={sheetConfigForm.sheetActCol}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetActCol: e.target.value.toUpperCase() }))}
                placeholder="I" />
              <TextField label="Cột TTKV nhận VT" size="small"
                value={sheetConfigForm.sheetTtkvCol}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetTtkvCol: e.target.value.toUpperCase() }))}
                placeholder="K" />
              <TextField label="Cột Đã chuyển VT lên trạm" size="small" sx={{ gridColumn: '1 / -1' }}
                value={sheetConfigForm.sheetSiteRecvCol}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetSiteRecvCol: e.target.value.toUpperCase() }))}
                placeholder="M" />
            </Box>
            <Divider />
            <Typography sx={{ fontSize: '0.78rem', color: palette.text.muted }}>
              Cấu hình từng cột tiến độ thi công riêng (không cần liên tiếp). Hệ thống dùng các cột này để
              ghi ngược lên Sheet khi kỹ thuật cập nhật, và để đồng bộ dữ liệu đã có sẵn trên Sheet về hệ thống.
              Bỏ trống cột nào thì cột đó không được đồng bộ.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
              <TextField label="Cột Kế hoạch thực hiện" size="small"
                value={sheetConfigForm.sheetPlanDateCol}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetPlanDateCol: e.target.value.toUpperCase() }))}
                placeholder="O" />
              <TextField label="Cột NS thực hiện" size="small"
                value={sheetConfigForm.sheetExecutorCol}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetExecutorCol: e.target.value.toUpperCase() }))}
                placeholder="P" />
              <TextField label="Cột Hoàn thành Lắp đặt" size="small"
                value={sheetConfigForm.sheetInstallCol}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetInstallCol: e.target.value.toUpperCase() }))}
                placeholder="Q" />
              <TextField label="Cột Chụp hình" size="small"
                value={sheetConfigForm.sheetPhotoCol}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetPhotoCol: e.target.value.toUpperCase() }))}
                placeholder="R" />
              <TextField label="Cột Tích hợp" size="small"
                value={sheetConfigForm.sheetIntegrationCol}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetIntegrationCol: e.target.value.toUpperCase() }))}
                placeholder="S" />
              <TextField label="Cột Ngày hoàn thành" size="small"
                value={sheetConfigForm.sheetCompletedDateCol}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetCompletedDateCol: e.target.value.toUpperCase() }))}
                placeholder="V" />
              <TextField label="Cột Ghi chú" size="small"
                value={sheetConfigForm.sheetNoteCol}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetNoteCol: e.target.value.toUpperCase() }))}
                placeholder="T" />
              <TextField label="Cột Vướng mắc / Hủy" size="small"
                value={sheetConfigForm.sheetIssueCol}
                onChange={(e) => setSheetConfigForm((p) => ({ ...p, sheetIssueCol: e.target.value.toUpperCase() }))}
                placeholder="U" />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSheetConfigSolution(null)}>Hủy</Button>
          <Button variant="contained" disabled={saveSheetConfigMutation.isPending}
            onClick={() => {
              if (!sheetConfigSolution) return;
              saveSheetConfigMutation.mutate({ solutionId: sheetConfigSolution.id, config: sheetConfigForm });
            }}>
            {saveSheetConfigMutation.isPending ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit period dialog ───────────────────────────────────── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}
        slotProps={{ paper: { sx: { maxHeight: isMobile ? '100%' : 'calc(100vh - 96px)' } } }}>
        <DialogTitle>Sửa thông tin kỳ thực hiện</DialogTitle>
        <DialogContent dividers sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Mã kỳ *" fullWidth size="small"
              value={editForm.periodCode}
              onChange={(e) => setEditForm((p) => ({ ...p, periodCode: e.target.value }))} />
            <TextField label="Tên kỳ *" fullWidth size="small"
              value={editForm.periodName}
              onChange={(e) => setEditForm((p) => ({ ...p, periodName: e.target.value }))} />
            <TextField label="Ngày bắt đầu *" type="date" fullWidth size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={editForm.startDate}
              onChange={(e) => setEditForm((p) => ({ ...p, startDate: e.target.value }))} />
            <TextField label="Ngày kết thúc *" type="date" fullWidth size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!(editForm.endDate && editForm.startDate && new Date(editForm.endDate) <= new Date(editForm.startDate))}
              helperText={editForm.endDate && editForm.startDate && new Date(editForm.endDate) <= new Date(editForm.startDate) ? 'Ngày kết thúc phải sau ngày bắt đầu' : ''}
              value={editForm.endDate}
              onChange={(e) => setEditForm((p) => ({ ...p, endDate: e.target.value }))} />
            <Divider />
            <TextField label="Google Sheet ID" fullWidth size="small"
              value={editForm.googleSheetId}
              onChange={(e) => setEditForm((p) => ({ ...p, googleSheetId: e.target.value }))}
              placeholder="Ví dụ: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              helperText="Lấy từ URL: docs.google.com/spreadsheets/d/{ID}/edit" />
            <TextField label="Tên tab (Sheet)" fullWidth size="small"
              value={editForm.googleSheetTab}
              onChange={(e) => setEditForm((p) => ({ ...p, googleSheetTab: e.target.value }))}
              placeholder="Sheet1"
              helperText="Tên tab chứa dữ liệu. Mặc định là Sheet1" />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Dòng bắt đầu" size="small" type="number" sx={{ flex: 1 }}
                value={editForm.googleSheetStartRow}
                onChange={(e) => setEditForm((p) => ({ ...p, googleSheetStartRow: e.target.value }))}
                placeholder="6" helperText="Dòng dữ liệu đầu tiên" />
              <TextField label="Cột Mã trạm" size="small" sx={{ flex: 1 }}
                value={editForm.googleSheetSiteCol}
                onChange={(e) => setEditForm((p) => ({ ...p, googleSheetSiteCol: e.target.value.toUpperCase() }))}
                placeholder="D" helperText="Chữ cột trên Sheet" />
            </Box>

            {canEdit && (period?.periodSolutions?.length ?? 0) > 0 && (
              <Box>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: palette.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
                  Cột giải pháp trên Sheet (theo thứ tự đã gán)
                </Typography>
                <Stack spacing={1}>
                  {period!.periodSolutions!.map((ps: any, idx: number) => (
                    <Box key={ps.solution.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography sx={{ fontSize: '0.8125rem', flex: 1, color: palette.text.primary }}>
                        {ps.solution.solutionName} <Typography component="span" sx={{ fontSize: '0.7rem', color: palette.text.muted }}>({ps.solution.solutionCode})</Typography>
                      </Typography>
                      <TextField size="small" placeholder="Cột"
                        value={genColEdits[ps.solution.id] ?? ps.genCol ?? ''}
                        onChange={(e) => setGenColEdits((p) => ({ ...p, [ps.solution.id]: e.target.value.toUpperCase() }))}
                        onBlur={(e) => {
                          const val = e.target.value.trim().toUpperCase();
                          if (val !== (ps.genCol ?? '')) {
                            saveGenColMutation.mutate({ solutionId: ps.solution.id, genCol: val });
                          }
                          // Tự động điền cột tăng dần cho các giải pháp tiếp theo còn trống
                          if (idx === 0 && val) {
                            const baseIdx = colLetterToIndex(val);
                            const rest = period!.periodSolutions!.slice(1);
                            rest.forEach((other: any, offset: number) => {
                              const alreadySet = (genColEdits[other.solution.id] ?? other.genCol ?? '').trim();
                              if (alreadySet) return;
                              const nextCol = colIndexToLetter(baseIdx + offset + 1);
                              setGenColEdits((p) => ({ ...p, [other.solution.id]: nextCol }));
                              saveGenColMutation.mutate({ solutionId: other.solution.id, genCol: nextCol });
                            });
                          }
                        }}
                        sx={{ width: 90 }} />
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Hủy</Button>
          <Button variant="contained" disabled={
            editMutation.isPending ||
            !editForm.periodCode.trim() || !editForm.periodName.trim() ||
            !editForm.startDate || !editForm.endDate ||
            new Date(editForm.endDate) <= new Date(editForm.startDate)
          }
            onClick={() => editMutation.mutate(editForm)}>
            {editMutation.isPending ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </DialogActions>
      </Dialog>

      {period && (
        <SheetSyncDialog
          open={sheetSyncOpen}
          periodCode={period.periodCode}
          onClose={() => setSheetSyncOpen(false)}
          onSuccess={(created) => {
            qc.invalidateQueries({ queryKey: ['period-wos', periodId] });
            qc.invalidateQueries({ queryKey: ['periods'] });
            setSheetSyncOpen(false);
            setSnack({ msg: `Đã tạo ${created} phiếu thi công từ Google Sheet` });
          }}
        />
      )}

      <Snackbar open={!!snack.msg} autoHideDuration={3500}
        onClose={() => setSnack({ msg: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.sev || 'success'} onClose={() => setSnack({ msg: '' })}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
