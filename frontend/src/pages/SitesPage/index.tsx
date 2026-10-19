import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  Box, Button, TextField, Stack, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Snackbar, Typography,
  Fab, CircularProgress,
  useMediaQuery, useTheme,
} from '@mui/material';
import { Add, Download, Upload, DeleteForever, EditOutlined, DeleteOutlined } from '@mui/icons-material';
import type { ColDef, SelectionChangedEvent } from 'ag-grid-community';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSites, createSite, updateSite, deleteSite, importSites, exportSites, downloadSiteTemplate, bulkDeleteSites } from '../../api/sites';
import { getTtkvs } from '../../api/ttkvs';
import { downloadBlob } from '../../utils/download';
import { getApiErrorMessage } from '../../api/axios';
import type { Site } from '../../types';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PageHeader from '../../components/ui/PageHeader';
import Toolbar from '../../components/ui/Toolbar';
import DataGrid from '../../components/ui/DataGrid';
import MobileList from '../../components/ui/MobileList';
import { NAV_FAB_BOTTOM } from '../../components/layout/BottomNav';
import StatusChip from '../../components/ui/StatusChip';
import { StatusCellRenderer, ActionsCellRenderer } from '../../components/ui/gridCells';
import { palette } from '../../theme/tokens';
import { useAuth } from '../../hooks/useAuth';

type SiteForm = Partial<Site> & { ttkvCode?: string | '' };
const emptyForm: SiteForm = { siteCode: '', siteName: '', province: '', district: '', siteType: '', ttkvCode: '', address: '', managerName: '', phone: '' };

/* ── Swipeable site card ──────────────────────────────────────────────── */
function SwipeableSiteCard({ site, onEdit, onDelete, canEdit }: { site: Site; onEdit: () => void; onDelete: () => void; canEdit: boolean }) {
  const ACTION_W = canEdit ? 148 : 0;
  const [offset, setOffset] = useState(0);
  const [open, setOpen]     = useState(false);
  const startX   = useRef(0);
  const startY   = useRef(0);
  const dragging = useRef(false);
  const locked   = useRef<'h' | 'v' | null>(null);

  const snap = (toOpen: boolean) => { setOpen(toOpen); setOffset(toOpen ? -ACTION_W : 0); };

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
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

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: 2.5 }}>
      {canEdit && (
        <Box sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: ACTION_W, display: 'flex', alignItems: 'stretch' }}>
          <Button onClick={() => { snap(false); onEdit(); }} sx={{
            flex: 1, borderRadius: 0, bgcolor: palette.brand.main, color: '#fff',
            fontSize: '0.7rem', fontWeight: 700, flexDirection: 'column', gap: 0.25,
            '&:hover': { bgcolor: palette.brand.dark },
          }}>
            <EditOutlined sx={{ fontSize: 20 }} />
            Cập nhật
          </Button>
          <Button onClick={() => { snap(false); onDelete(); }} sx={{
            flex: 1, borderRadius: 0, bgcolor: '#DC2626', color: '#fff',
            fontSize: '0.7rem', fontWeight: 700, flexDirection: 'column', gap: 0.25,
            '&:hover': { bgcolor: '#B91C1C' },
          }}>
            <DeleteOutlined sx={{ fontSize: 20 }} />
            Xóa
          </Button>
        </Box>
      )}

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
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: palette.text.primary }}>
              {site.siteCode}
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: palette.text.secondary, mt: 0.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {site.siteName}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted, mt: 0.15 }}>
              {[site.province, site.district].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, opacity: open ? 0 : 0.25, transition: 'opacity 0.2s', flexShrink: 0, mt: 0.25 }}>
            {[20, 14, 8].map((w) => <Box key={w} sx={{ width: w, height: 2, bgcolor: palette.text.muted, borderRadius: 1 }} />)}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
          {site.ttkvCode && <StatusChip label={site.ttkvCode} tone="info" size="sm" />}
          {site.siteType && <StatusChip label={site.siteType} tone="neutral" size="sm" />}
          <StatusChip label={site.active ? 'Hoạt động' : 'Tắt'} tone={site.active ? 'success' : 'neutral'} size="sm" />
        </Box>

        {(site.managerName || site.phone) && (
          <Box sx={{ display: 'flex', gap: 2, mt: 0.75 }}>
            {site.managerName && <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted }}>NVQLT: {site.managerName}</Typography>}
            {site.phone && <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted }}>{site.phone}</Typography>}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function SitesPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const canEdit = user?.role !== 'TECHNICIAN';

  const qc = useQueryClient();
  const [search, setSearch]       = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSite, setEditSite]   = useState<SiteForm>(emptyForm);
  const [isEdit, setIsEdit]       = useState(false);
  const [deleteId, setDeleteId]   = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; sev?: 'success' | 'warning' | 'error' }>({ msg: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const [visibleCount, setVisibleCount] = useState(50);
  const mobileListRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sites', search],
    queryFn: () => getSites({ search, limit: '100000' }).then((r) => r.data),
  });

  const rows = data?.data || [];

  // Reset visible count khi search thay đổi
  useEffect(() => { setVisibleCount(50); }, [search]);

  // Infinite scroll trên mobile
  useEffect(() => {
    const el = mobileListRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
        setVisibleCount((c) => Math.min(c + 50, rows.length));
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [rows.length]);

  const { data: ttkvList = [] } = useQuery({
    queryKey: ['ttkvs'],
    queryFn: getTtkvs,
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: (s: SiteForm) => {
      const payload = { ...s, ttkvCode: s.ttkvCode !== '' ? s.ttkvCode : undefined };
      return isEdit && editSite.id ? updateSite(editSite.id, payload) : createSite(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); setDialogOpen(false); setSnack({ msg: isEdit ? 'Đã cập nhật trạm' : 'Đã thêm trạm' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSite(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); setSnack({ msg: 'Đã xóa trạm' }); },
    onError: (e: any) => setSnack({ msg: e?.response?.data?.message || 'Không thể xóa', sev: 'error' }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => bulkDeleteSites(ids).then((r) => r.data),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      setSelectedIds([]);
      if (d.skipped.length === 0) {
        setSnack({ msg: `Đã xóa ${d.deleted} trạm` });
      } else {
        setSnack({ msg: `Đã xóa ${d.deleted} trạm. Bỏ qua ${d.skipped.length} trạm: ${d.skipped.join(', ')}`, sev: 'warning' });
      }
    },
    onError: (e: any) => setSnack({ msg: e?.response?.data?.message || 'Lỗi khi xóa', sev: 'error' }),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => importSites(file).then((r) => r.data),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      if (d.errors.length === 0 && d.updated === 0) {
        setSnack({ msg: `Đã import ${d.imported} trạm mới` });
      } else {
        const parts = [`Đã thêm ${d.imported} trạm mới`];
        if (d.updated > 0) parts.push(`cập nhật ${d.updated} trạm đã tồn tại`);
        if (d.errors.length > 0) parts.push(`${d.errors.length} dòng lỗi: ${d.errors.slice(0, 5).join('; ')}${d.errors.length > 5 ? '...' : ''}`);
        setSnack({ msg: parts.join('. '), sev: d.errors.length > 0 ? 'warning' : 'success' });
      }
    },
    onError: (e) => setSnack({ msg: getApiErrorMessage(e, 'Import thất bại'), sev: 'error' }),
  });

  const handleExport = async () => { downloadBlob((await exportSites()).data as Blob, 'danh-sach-tram.xlsx'); };
  const handleDownloadTemplate = async () => { downloadBlob((await downloadSiteTemplate()).data as Blob, 'mau-import-tram.xlsx'); };

  const onSelectionChanged = useCallback((e: SelectionChangedEvent) => {
    setSelectedIds(e.api.getSelectedRows().map((r: Site) => r.id));
  }, []);

  const columnDefs = useMemo<ColDef[]>(() => [
    ...(canEdit ? [{ checkboxSelection: true, headerCheckboxSelection: true, width: 48, pinned: 'left' as const, sortable: false, filter: false, resizable: false }] : []),
    { field: 'siteCode', headerName: 'Mã trạm', width: 130 },
    { field: 'siteName', headerName: 'Tên trạm', flex: 1, minWidth: 180 },
    { field: 'province', headerName: 'Tỉnh/Thành', width: 140 },
    { field: 'district', headerName: 'Quận/Huyện', width: 140 },
    { field: 'siteType', headerName: 'Loại trạm', width: 120 },
    { field: 'ttkvCode', headerName: 'TTKV', width: 100 },
    { field: 'managerName', headerName: 'NVQLT', width: 160 },
    { field: 'phone', headerName: 'SĐT', width: 130 },
    {
      field: 'active', headerName: 'Trạng thái', width: 130, filter: false,
      cellRenderer: StatusCellRenderer,
      cellRendererParams: { toneMap: { true: 'success', false: 'neutral' }, labelMap: { true: 'Hoạt động', false: 'Tắt' } },
    },
    ...(canEdit ? [{
      headerName: '', width: 96, pinned: 'right' as const, sortable: false, filter: false, resizable: false,
      cellRenderer: ActionsCellRenderer,
      cellRendererParams: {
        onEdit: (row: Site) => { setEditSite({ ...row, ttkvCode: row.ttkvCode ?? '' }); setIsEdit(true); setDialogOpen(true); },
        onDelete: (row: Site) => setDeleteId(row.id),
      },
    }] : []),
  ], [canEdit]);

  /* ── Dialog ─────────────────────────────────────────────── */
  const formDialog = (
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
      slotProps={{ paper: { sx: { mx: { xs: 1.5, sm: 'auto' } } } }}>
      <DialogTitle>{isEdit ? 'Cập nhật trạm' : 'Thêm trạm mới'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {[
            { label: 'Mã trạm *', key: 'siteCode', disabled: isEdit },
            { label: 'Tên trạm *', key: 'siteName' },
            { label: 'Tỉnh/Thành', key: 'province' },
            { label: 'Quận/Huyện', key: 'district' },
            { label: 'Loại trạm', key: 'siteType' },
            { label: 'Địa chỉ', key: 'address' },
            { label: 'NVQLT', key: 'managerName' },
            { label: 'Số điện thoại', key: 'phone' },
          ].map((f) => (
            <TextField key={f.key} label={f.label} fullWidth size="small"
              disabled={f.disabled}
              value={(editSite as any)[f.key] || ''}
              onChange={(e) => setEditSite((prev) => ({ ...prev, [f.key]: e.target.value }))} />
          ))}

          <TextField select label="TTKV" fullWidth size="small"
            value={editSite.ttkvCode ?? ''}
            onChange={(e) => setEditSite((prev) => ({ ...prev, ttkvCode: e.target.value || '' }))}>
            <MenuItem value=""><em>— Không chọn —</em></MenuItem>
            {ttkvList.map((t) => (
              <MenuItem key={t.code} value={t.code}>{t.code} – {t.name}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDialogOpen(false)}>Hủy</Button>
        <Button variant="contained" onClick={() => saveMutation.mutate(editSite)}>Lưu</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: { xs: 'calc(100dvh - 148px)', md: 'calc(100vh - 102px)' } }}>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden
        onChange={(e) => { if (e.target.files?.[0] && !importMutation.isPending) { importMutation.mutate(e.target.files[0]); e.target.value = ''; } }} />

      {!isMobile && (
        <PageHeader
          title="Danh mục trạm"
          subtitle="Quản lý danh sách trạm BTS/NodeB/eNodeB/gNodeB"
          actions={canEdit ? (
            <>
              <Button startIcon={<Download />} variant="outlined" onClick={handleDownloadTemplate}>Tải mẫu</Button>
              <Button startIcon={importMutation.isPending ? <CircularProgress size={16} /> : <Upload />} variant="outlined"
                disabled={importMutation.isPending} onClick={() => fileRef.current?.click()}>
                {importMutation.isPending ? 'Đang import...' : 'Import'}
              </Button>
              <Button startIcon={<Download />} variant="outlined" onClick={handleExport}>Export</Button>
              <Button startIcon={<Add />} variant="contained"
                onClick={() => { setEditSite(emptyForm); setIsEdit(false); setDialogOpen(true); }}>
                Thêm trạm
              </Button>
            </>
          ) : undefined}
        />
      )}

      <Toolbar search={search} onSearch={setSearch} searchPlaceholder="Tìm mã trạm, tên trạm..." searchWidth={320}>
        {canEdit && selectedIds.length > 0 && (
          <Button startIcon={<DeleteForever />} variant="outlined" color="error" size="small"
            onClick={() => setBulkDeleteOpen(true)}>
            Xóa {selectedIds.length}
          </Button>
        )}
      </Toolbar>

      {!isMobile && (
        <DataGrid
          rowData={rows}
          columnDefs={columnDefs}
          loading={isLoading}
          rowSelection="multiple"
          suppressRowClickSelection
          onSelectionChanged={onSelectionChanged}
          pagination paginationPageSize={25} paginationPageSizeSelector={[25, 50, 100]}
        />
      )}

      {isMobile && (
        <Box ref={mobileListRef} sx={{ flex: 1, overflowY: 'auto' }}>
          <MobileList loading={isLoading} count={rows.length}>
            {rows.slice(0, visibleCount).map((site) => (
              <SwipeableSiteCard
                key={site.id}
                site={site}
                onEdit={() => { setEditSite({ ...site, ttkvCode: site.ttkvCode ?? '' }); setIsEdit(true); setDialogOpen(true); }}
                onDelete={() => setDeleteId(site.id)}
                canEdit={canEdit}
              />
            ))}
            {visibleCount < rows.length && (
              <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Hiển thị {visibleCount}/{rows.length} trạm — cuộn xuống để tải thêm
                </Typography>
              </Box>
            )}
          </MobileList>
        </Box>
      )}

      {isMobile && canEdit && (
        <Fab
          color="primary" size="medium"
          onClick={() => { setEditSite(emptyForm); setIsEdit(false); setDialogOpen(true); }}
          sx={{ position: 'fixed', bottom: NAV_FAB_BOTTOM, right: 16, zIndex: 1100, boxShadow: '0 4px 16px rgba(45,108,223,0.4)' }}
        >
          <Add />
        </Fab>
      )}

      {formDialog}

      <ConfirmDialog open={deleteId !== null} title="Xóa trạm"
        message="Trạm đã phát sinh dữ liệu sẽ không thể xóa."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onClose={() => setDeleteId(null)} />

      <ConfirmDialog open={bulkDeleteOpen} title={`Xóa ${selectedIds.length} trạm đã chọn`}
        message={
          <Typography variant="body2">
            Trạm chưa phát sinh dữ liệu sẽ bị xóa vĩnh viễn.<br />
            Trạm đã có phiếu thi công sẽ được <strong>bỏ qua</strong>.
          </Typography>
        }
        onConfirm={() => bulkDeleteMutation.mutate(selectedIds)}
        onClose={() => setBulkDeleteOpen(false)} />

      <Snackbar open={!!snack.msg} autoHideDuration={snack.sev && snack.sev !== 'success' ? 8000 : 4000} onClose={() => setSnack({ msg: '' })}>
        <Alert severity={snack.sev ?? 'success'} onClose={() => setSnack({ msg: '' })}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
