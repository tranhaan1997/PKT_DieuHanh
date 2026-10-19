import { useState, useMemo, useRef } from 'react';
import {
  Box, Typography, Button, Stack, Chip, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Autocomplete,
  Fab, useTheme, useMediaQuery,
} from '@mui/material';
import { Add, VisibilityOutlined, DeleteOutlined } from '@mui/icons-material';
import type { ColDef } from 'ag-grid-community';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPeriods, createPeriod, deletePeriod } from '../../api/periods';
import { getUsers } from '../../api/users';
import type { UserOption } from '../../api/users';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PeriodDetail from './PeriodDetail';
import PageHeader from '../../components/ui/PageHeader';
import DataGrid from '../../components/ui/DataGrid';
import MobileList from '../../components/ui/MobileList';
import { NAV_FAB_BOTTOM } from '../../components/layout/BottomNav';
import StatusChip from '../../components/ui/StatusChip';
import { StatusCellRenderer, ChipListCellRenderer, ActionsCellRenderer } from '../../components/ui/gridCells';
import { palette } from '../../theme/tokens';
import type { StatusKey } from '../../theme/tokens';
import { useAuth } from '../../hooks/useAuth';

const STATUS_TONE: Record<string, StatusKey> = { DRAFT: 'neutral', ACTIVE: 'info', CLOSED: 'success' };
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Nháp', ACTIVE: 'Đang thực hiện', CLOSED: 'Đã đóng' };

const emptyForm = { periodCode: '', periodName: '', startDate: '', endDate: '' };
const emptyErrors = { periodCode: '', periodName: '', startDate: '', endDate: '' };

function validatePeriodForm(form: typeof emptyForm) {
  const errs = { ...emptyErrors };
  if (!form.periodCode.trim()) errs.periodCode = 'Vui lòng nhập mã kỳ';
  if (!form.periodName.trim()) errs.periodName = 'Vui lòng nhập tên kỳ';
  if (!form.startDate) {
    errs.startDate = 'Vui lòng chọn ngày bắt đầu';
  } else if (isNaN(Date.parse(form.startDate))) {
    errs.startDate = 'Ngày bắt đầu không hợp lệ';
  }
  if (!form.endDate) {
    errs.endDate = 'Vui lòng chọn ngày kết thúc';
  } else if (isNaN(Date.parse(form.endDate))) {
    errs.endDate = 'Ngày kết thúc không hợp lệ';
  } else if (form.startDate && !errs.startDate && new Date(form.endDate) <= new Date(form.startDate)) {
    errs.endDate = 'Ngày kết thúc phải sau ngày bắt đầu';
  }
  return errs;
}


const fmtDate = (v: any) => (v ? new Date(v as string).toLocaleDateString('vi-VN') : '');

/* ── Swipeable period card ────────────────────────────────────────────── */
function SwipeablePeriodCard({ period, onView, onDelete, canView, canEdit }: {
  period: any; onView: () => void; onDelete: () => void; canView: boolean; canEdit: boolean;
}) {
  const ACTION_W = (canView ? 74 : 0) + (canEdit ? 74 : 0);
  const [offset, setOffset] = useState(0);
  const [open, setOpen]     = useState(false);
  const startX = useRef(0); const startY = useRef(0);
  const dragging = useRef(false); const locked = useRef<'h' | 'v' | null>(null);

  const snap = (toOpen: boolean) => { setOpen(toOpen); setOffset(toOpen ? -ACTION_W : 0); };

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX; startY.current = e.touches[0].clientY;
    dragging.current = true; locked.current = null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!locked.current) locked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    if (locked.current === 'v') return;
    e.preventDefault();
    setOffset(Math.min(0, Math.max(-ACTION_W, (open ? -ACTION_W : 0) + dx)));
  };
  const onTouchEnd = () => {
    dragging.current = false;
    if (locked.current === 'v') return;
    snap(offset < -(ACTION_W * 0.4));
  };

  const tone: StatusKey = STATUS_TONE[period.status] || 'neutral';
  const supervisors: string[] = (period.periodUsers || []).map((pu: any) => pu.user.fullName);

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: 2.5 }}>
      {/* Action buttons */}
      <Box sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: ACTION_W, display: 'flex', alignItems: 'stretch' }}>
        {canView && (
          <Button onClick={() => { snap(false); onView(); }} sx={{
            flex: 1, borderRadius: 0, bgcolor: palette.brand.main, color: '#fff',
            fontSize: '0.7rem', fontWeight: 700, flexDirection: 'column', gap: 0.25,
            '&:hover': { bgcolor: palette.brand.dark },
          }}>
            <VisibilityOutlined sx={{ fontSize: 20 }} />
            Xem chi tiết
          </Button>
        )}
        {canEdit && (
          <Button onClick={() => { snap(false); onDelete(); }} sx={{
            flex: 1, borderRadius: 0, bgcolor: '#DC2626', color: '#fff',
            fontSize: '0.7rem', fontWeight: 700, flexDirection: 'column', gap: 0.25,
            '&:hover': { bgcolor: '#B91C1C' },
          }}>
            <DeleteOutlined sx={{ fontSize: 20 }} />
            Xóa
          </Button>
        )}
      </Box>

      {/* Card */}
      <Box
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onClick={() => open && snap(false)}
        sx={{
          position: 'relative', zIndex: 1,
          transform: `translateX(${offset}px)`,
          transition: dragging.current ? 'none' : 'transform 0.22s ease',
          bgcolor: palette.card, border: `1px solid ${palette.border}`,
          borderRadius: 2.5, p: 1.5, userSelect: 'none', touchAction: 'pan-y',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: palette.text.primary }}>{period.periodCode}</Typography>
              {period._count?.workOrders > 0 && (
                <Chip label={`${period._count.workOrders} WO`} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }} />
              )}
            </Box>
            <Typography sx={{ fontSize: '0.8rem', color: palette.text.secondary, mt: 0.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {period.periodName}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted, mt: 0.15 }}>
              {[fmtDate(period.startDate), fmtDate(period.endDate)].filter(Boolean).join(' – ')}
            </Typography>
          </Box>
          {/* Swipe hint */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, opacity: open ? 0 : 0.25, transition: 'opacity 0.2s', flexShrink: 0, mt: 0.25 }}>
            {[20, 14, 8].map((w) => <Box key={w} sx={{ width: w, height: 2, bgcolor: palette.text.muted, borderRadius: 1 }} />)}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
          <StatusChip label={STATUS_LABEL[period.status] || period.status} tone={tone} size="sm" />
          {supervisors.slice(0, 2).map((name: string) => (
            <StatusChip key={name} label={name} tone="info" size="sm" />
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export default function PeriodsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const canView   = user?.role !== 'TECHNICIAN';
  const canEdit   = user?.role !== 'TECHNICIAN';
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState(emptyErrors);
  const [selectedSupervisors, setSelectedSupervisors] = useState<UserOption[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [snack, setSnack] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['periods'],
    queryFn: () => getPeriods().then((r) => r.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof emptyForm & { supervisorIds: number[] }) => createPeriod(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periods'] });
      setDialogOpen(false);
      setSelectedSupervisors([]);
      setSnack('Đã tạo kỳ thực hiện');
    },
    onError: (e: any) => {
      setSnack('Lỗi: ' + (e?.response?.data?.message || e?.message || 'Không thể tạo kỳ'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePeriod(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['periods'] }); setSnack('Đã xóa kỳ thực hiện'); },
  });

  const columnDefs = useMemo<ColDef[]>(() => [
    { field: 'periodCode', headerName: 'Mã kỳ', width: 140 },
    { field: 'periodName', headerName: 'Tên kỳ thực hiện', flex: 1, minWidth: 200 },
    { field: 'startDate', headerName: 'Bắt đầu', width: 120, valueFormatter: (p) => fmtDate(p.value) },
    { field: 'endDate', headerName: 'Kết thúc', width: 120, valueFormatter: (p) => fmtDate(p.value) },
    {
      field: 'status', headerName: 'Trạng thái', width: 150, filter: false,
      cellRenderer: StatusCellRenderer,
      cellRendererParams: { toneMap: STATUS_TONE, labelMap: STATUS_LABEL, fallbackTone: 'neutral' },
    },
    {
      field: 'periodUsers', headerName: 'Nhân sự điều hành', flex: 1.2, minWidth: 220, sortable: false, filter: false,
      cellRenderer: ChipListCellRenderer,
      cellRendererParams: { getLabels: (row: any) => (row.periodUsers || []).map((pu: any) => pu.user.fullName), tone: 'info' },
    },
    { headerName: 'WO', width: 80, type: 'numericColumn', valueGetter: (p) => p.data?._count?.workOrders || 0 },
    {
      headerName: '', width: (canView ? 48 : 0) + (canEdit ? 48 : 0) + 8, pinned: 'right', sortable: false, filter: false, resizable: false,
      cellRenderer: ActionsCellRenderer,
      cellRendererParams: {
        ...(canView && { onView: (row: any) => setDetailId(row.id) }),
        ...(canEdit && { onDelete: (row: any) => setDeleteId(row.id) }),
      },
    },
  ], []);

  if (detailId && canView) {
    return <PeriodDetail periodId={detailId} onBack={() => setDetailId(null)} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: { xs: 'calc(100dvh - 148px)', md: 'calc(100vh - 102px)' } }}>
      {!isMobile && (
        <PageHeader
          title="Kỳ thực hiện"
          subtitle="Quản lý các kỳ thi công và phân công nhân sự điều hành"
          actions={canEdit ? (
            <Button startIcon={<Add />} variant="contained"
              onClick={() => { setForm(emptyForm); setFormErrors(emptyErrors); setSelectedSupervisors([]); setDialogOpen(true); }}>
              Tạo kỳ mới
            </Button>
          ) : undefined}
        />
      )}

      {!isMobile && (
        <DataGrid
          rowData={data || []}
          columnDefs={columnDefs}
          loading={isLoading}
          pagination
          paginationPageSize={25}
          paginationPageSizeSelector={[25, 50, 100]}
        />
      )}

      {isMobile && (
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <MobileList loading={isLoading} count={(data || []).length}>
            {(data || []).map((period) => (
              <SwipeablePeriodCard
                key={period.id}
                period={period}
                onView={() => setDetailId(period.id)}
                onDelete={() => setDeleteId(period.id)}
                canView={canView}
                canEdit={canEdit}
              />
            ))}
          </MobileList>
        </Box>
      )}

      {isMobile && canEdit && (
        <Fab color="primary" size="medium"
          onClick={() => { setForm(emptyForm); setFormErrors(emptyErrors); setSelectedSupervisors([]); setDialogOpen(true); }}
          sx={{ position: 'fixed', bottom: NAV_FAB_BOTTOM, right: 16, zIndex: 1100, boxShadow: '0 4px 16px rgba(45,108,223,0.4)' }}>
          <Add />
        </Fab>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tạo kỳ thực hiện mới</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Mã kỳ *" fullWidth size={isMobile ? 'medium' : 'small'}
              error={!!formErrors.periodCode} helperText={formErrors.periodCode}
              value={form.periodCode} onChange={(e) => { setForm((p) => ({ ...p, periodCode: e.target.value })); setFormErrors((p) => ({ ...p, periodCode: '' })); }} />
            <TextField label="Tên kỳ *" fullWidth size={isMobile ? 'medium' : 'small'}
              error={!!formErrors.periodName} helperText={formErrors.periodName}
              value={form.periodName} onChange={(e) => { setForm((p) => ({ ...p, periodName: e.target.value })); setFormErrors((p) => ({ ...p, periodName: '' })); }} />
            <TextField label="Ngày bắt đầu *" type="date" fullWidth size={isMobile ? 'medium' : 'small'}
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!formErrors.startDate} helperText={formErrors.startDate}
              value={form.startDate} onChange={(e) => { setForm((p) => ({ ...p, startDate: e.target.value })); setFormErrors((p) => ({ ...p, startDate: '', endDate: '' })); }} />
            <TextField label="Ngày kết thúc *" type="date" fullWidth size={isMobile ? 'medium' : 'small'}
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!formErrors.endDate} helperText={formErrors.endDate}
              value={form.endDate} onChange={(e) => { setForm((p) => ({ ...p, endDate: e.target.value })); setFormErrors((p) => ({ ...p, endDate: '' })); }} />

            <Autocomplete<UserOption, true, false, false>
              multiple
              options={users || []}
              value={selectedSupervisors}
              onChange={(_, v) => setSelectedSupervisors(v)}
              getOptionLabel={(o) => o.fullName}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start !important' }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>{option.fullName}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: palette.text.muted }}>
                    {option.department || '—'} · {option.username}
                  </Typography>
                </Box>
              )}
              renderValue={(value, getItemProps) =>
                value.map((option, index) => {
                  const { key, ...itemProps } = getItemProps({ index });
                  return <Chip key={key} {...itemProps} label={option.fullName} size="small" />;
                })
              }
              renderInput={(params) => (
                <TextField {...params} label="Nhân sự điều hành" size="small"
                  placeholder={selectedSupervisors.length ? '' : 'Chọn nhân sự phụ trách...'} />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Hủy</Button>
          <Button variant="contained" disabled={createMutation.isPending}
            onClick={() => {
              const errs = validatePeriodForm(form);
              setFormErrors(errs);
              if (Object.values(errs).some(Boolean)) return;
              createMutation.mutate({ ...form, supervisorIds: selectedSupervisors.map((u) => u.id) });
            }}>
            {createMutation.isPending ? 'Đang tạo...' : 'Tạo'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} title="Xóa kỳ thực hiện"
        message="Xóa kỳ này sẽ xóa tất cả Phiếu thi công liên quan. Tiếp tục?"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onClose={() => setDeleteId(null)} />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity={snack.startsWith('Lỗi') ? 'error' : 'success'} onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>

    </Box>
  );
}
