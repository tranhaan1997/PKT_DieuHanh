import { useState, useMemo, useCallback } from 'react';
import {
  Box, Button, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Snackbar, Alert,
  FormControlLabel, Switch, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { Add, DeleteForever } from '@mui/icons-material';
import type { ColDef, SelectionChangedEvent } from 'ag-grid-community';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSolutions, createSolution, updateSolution, deleteSolution, bulkDeleteSolutions } from '../../api/solutions';
import type { Solution } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PageHeader from '../../components/ui/PageHeader';
import Toolbar from '../../components/ui/Toolbar';
import DataGrid from '../../components/ui/DataGrid';
import MobileList, { MobileCard } from '../../components/ui/MobileList';
import { StatusCellRenderer, ActionsCellRenderer } from '../../components/ui/gridCells';

const empty: Partial<Solution> = { solutionCode: '', solutionName: '', description: '', expectedDays: 30, active: true };

export default function SolutionsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<Solution>>(empty);
  const [isEdit, setIsEdit] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; sev?: 'success' | 'warning' | 'error' }>({ msg: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['solutions'],
    queryFn: () => getSolutions().then((r) => r.data),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((s) =>
      s.solutionCode.toLowerCase().includes(q) ||
      s.solutionName.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    );
  }, [data, search]);

  const saveMutation = useMutation({
    mutationFn: (s: Partial<Solution>) => (isEdit && form.id ? updateSolution(form.id, s) : createSolution(s)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solutions'] }); setDialogOpen(false); setSnack({ msg: isEdit ? 'Đã cập nhật' : 'Đã thêm giải pháp' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSolution(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solutions'] }); setSnack({ msg: 'Đã xóa giải pháp' }); },
    onError: (e: any) => setSnack({ msg: e?.response?.data?.message || 'Không thể xóa', sev: 'error' }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => bulkDeleteSolutions(ids).then((r) => r.data),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['solutions'] });
      setSelectedIds([]);
      if (d.skipped.length === 0) {
        setSnack({ msg: `Đã xóa ${d.deleted} giải pháp` });
      } else {
        setSnack({ msg: `Đã xóa ${d.deleted}. Bỏ qua ${d.skipped.length}: ${d.skipped.join(', ')}`, sev: 'warning' });
      }
    },
    onError: (e: any) => setSnack({ msg: e?.response?.data?.message || 'Lỗi khi xóa', sev: 'error' }),
  });

  const onSelectionChanged = useCallback((e: SelectionChangedEvent) => {
    setSelectedIds(e.api.getSelectedRows().map((r: Solution) => r.id));
  }, []);

  const columnDefs = useMemo<ColDef[]>(() => [
    ...(canEdit ? [{ checkboxSelection: true, headerCheckboxSelection: true, width: 48, pinned: 'left' as const, sortable: false, filter: false, resizable: false }] : []),
    { field: 'solutionCode', headerName: 'Mã giải pháp', width: 160 },
    { field: 'solutionName', headerName: 'Tên giải pháp', flex: 1, minWidth: 220 },
    { field: 'description', headerName: 'Mô tả', flex: 1.2, minWidth: 200 },
    // { field: 'expectedDays', headerName: 'SLA (ngày)', width: 130, type: 'numericColumn' },
    {
      field: 'active', headerName: 'Trạng thái', width: 130, filter: false,
      cellRenderer: StatusCellRenderer,
      cellRendererParams: { toneMap: { true: 'success', false: 'neutral' }, labelMap: { true: 'Hoạt động', false: 'Tắt' } },
    },
    ...(canEdit ? [{
      headerName: '', width: 96, pinned: 'right' as const, sortable: false, filter: false, resizable: false,
      cellRenderer: ActionsCellRenderer,
      cellRendererParams: {
        onEdit: (row: Solution) => { setForm(row); setIsEdit(true); setDialogOpen(true); },
        onDelete: (row: Solution) => setDeleteId(row.id),
      },
    }] : []),
  ], [canEdit]);

  const formDialog = (
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
      slotProps={{ paper: { sx: { mx: { xs: 1.5, sm: 'auto' } } } }}>
      <DialogTitle>{isEdit ? 'Cập nhật giải pháp' : 'Thêm giải pháp mới'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Mã giải pháp *" fullWidth size="small" disabled={isEdit}
            value={form.solutionCode || ''} onChange={(e) => setForm((p) => ({ ...p, solutionCode: e.target.value }))} />
          <TextField label="Tên giải pháp *" fullWidth size="small"
            value={form.solutionName || ''} onChange={(e) => setForm((p) => ({ ...p, solutionName: e.target.value }))} />
          <TextField label="Mô tả" fullWidth size="small" multiline rows={2}
            value={form.description || ''} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          {/* <TextField label="SLA (ngày)" type="number" fullWidth size="small"
            value={form.expectedDays || 30} onChange={(e) => setForm((p) => ({ ...p, expectedDays: parseInt(e.target.value) }))} /> */}
          {isEdit && (
            <FormControlLabel label="Đang sử dụng"
              control={<Switch checked={form.active ?? true}
                onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />} />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDialogOpen(false)}>Hủy</Button>
        <Button variant="contained" onClick={() => saveMutation.mutate(form)}>Lưu</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: { xs: 'calc(100dvh - 148px)', md: 'calc(100vh - 102px)' } }}>
      <PageHeader
        title="Danh mục giải pháp"
        subtitle="Loại giải pháp thi công"
        actions={
          canEdit ? (
            <Button startIcon={<Add />} variant="contained"
              onClick={() => { setForm(empty); setIsEdit(false); setDialogOpen(true); }}>
              Thêm giải pháp
            </Button>
          ) : undefined
        }
      />

      <Toolbar search={search} onSearch={setSearch} searchPlaceholder="Tìm mã, tên giải pháp..." searchWidth={300}>
        {canEdit && selectedIds.length > 0 && (
          <Button startIcon={<DeleteForever />} variant="outlined" color="error" size="small"
            onClick={() => setBulkDeleteOpen(true)}>
            Xóa {selectedIds.length}
          </Button>
        )}
      </Toolbar>

      {!isMobile && (
        <DataGrid rowData={filtered} columnDefs={columnDefs} loading={isLoading}
          rowSelection="multiple" suppressRowClickSelection onSelectionChanged={onSelectionChanged}
          pagination paginationPageSize={25} paginationPageSizeSelector={[25, 50, 100]} />
      )}

      {isMobile && (
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <MobileList loading={isLoading} count={filtered.length}>
            {filtered.map((sol) => (
              <MobileCard
                key={sol.id}
                title={sol.solutionCode}
                subtitle={sol.solutionName}
                meta={sol.description || undefined}
                chips={[
                  { label: sol.active ? 'Hoạt động' : 'Tắt', tone: sol.active ? 'success' : 'neutral' },
                ]}
                onEdit={canEdit ? () => { setForm(sol); setIsEdit(true); setDialogOpen(true); } : undefined}
                onDelete={canEdit ? () => setDeleteId(sol.id) : undefined}
              />
            ))}
          </MobileList>
        </Box>
      )}

      {formDialog}

      <ConfirmDialog open={deleteId !== null} title="Xóa giải pháp"
        message="Giải pháp đã phát sinh dữ liệu sẽ không thể xóa."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onClose={() => setDeleteId(null)} />

      <ConfirmDialog open={bulkDeleteOpen} title={`Xóa ${selectedIds.length} giải pháp đã chọn`}
        message={
          <Typography variant="body2">
            Giải pháp chưa phát sinh dữ liệu sẽ bị xóa.<br />
            Giải pháp đã dùng sẽ được <strong>bỏ qua</strong>.
          </Typography>
        }
        onConfirm={() => bulkDeleteMutation.mutate(selectedIds)}
        onClose={() => setBulkDeleteOpen(false)} />

      <Snackbar open={!!snack.msg} autoHideDuration={4000} onClose={() => setSnack({ msg: '' })}>
        <Alert severity={snack.sev ?? 'success'} onClose={() => setSnack({ msg: '' })}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
