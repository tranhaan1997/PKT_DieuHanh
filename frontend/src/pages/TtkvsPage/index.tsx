import { useState, useMemo } from 'react';
import {
  Box, Button, TextField, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Snackbar, Typography,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import type { ColDef } from 'ag-grid-community';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTtkvs, createTtkv, updateTtkv, deleteTtkv } from '../../api/ttkvs';
import type { Ttkv } from '../../api/ttkvs';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PageHeader from '../../components/ui/PageHeader';
import DataGrid from '../../components/ui/DataGrid';
import { ActionsCellRenderer } from '../../components/ui/gridCells';

const emptyForm = { code: '', name: '' };

export default function TtkvsPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]       = useState(emptyForm);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [deleteCode, setDeleteCode] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ msg: string; sev?: 'success' | 'error' }>({ msg: '' });

  const { data: rows = [], isLoading } = useQuery({ queryKey: ['ttkvs'], queryFn: getTtkvs });

  const saveMutation = useMutation({
    mutationFn: () =>
      editCode ? updateTtkv(editCode, { name: form.name }) : createTtkv(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ttkvs'] });
      setDialogOpen(false);
      setSnack({ msg: editCode ? 'Đã cập nhật TTKV' : 'Đã thêm TTKV' });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      setSnack({ msg: err?.response?.data?.message || 'Lỗi lưu TTKV', sev: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (code: string) => deleteTtkv(code),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ttkvs'] }); setSnack({ msg: 'Đã xóa TTKV' }); },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      setSnack({ msg: err?.response?.data?.message || 'Không thể xóa', sev: 'error' });
    },
  });

  const openAdd = () => { setForm(emptyForm); setEditCode(null); setDialogOpen(true); };
  const openEdit = (row: Ttkv) => { setForm({ code: row.code, name: row.name }); setEditCode(row.code); setDialogOpen(true); };

  const columnDefs = useMemo<ColDef[]>(() => [
    { field: 'code', headerName: 'Mã TTKV', width: 140 },
    { field: 'name', headerName: 'Tên khu vực', flex: 1, minWidth: 200 },
    {
      headerName: '', width: 96, pinned: 'right' as const, sortable: false, filter: false, resizable: false,
      cellRenderer: ActionsCellRenderer,
      cellRendererParams: {
        onEdit: (row: Ttkv) => openEdit(row),
        onDelete: (row: Ttkv) => setDeleteCode(row.code),
      },
    },
  ], []);

  const deleteTarget = rows.find((r) => r.code === deleteCode);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: 'calc(100vh - 102px)' }}>
      <PageHeader
        title="Danh mục TTKV"
        subtitle="Tổ thi công viễn thông — dùng cho phân quyền theo khu vực"
        actions={
          <Button startIcon={<Add />} variant="contained" onClick={openAdd}>Thêm TTKV</Button>
        }
      />

      <DataGrid
        rowData={rows}
        columnDefs={columnDefs}
        loading={isLoading}
        pagination={false}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editCode ? 'Cập nhật TTKV' : 'Thêm TTKV mới'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Mã TTKV *" size="small" fullWidth
              disabled={!!editCode}
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} />
            <TextField label="Tên khu vực *" size="small" fullWidth
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Hủy</Button>
          <Button variant="contained" disabled={!form.code || !form.name || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}>Lưu</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteCode !== null}
        title="Xóa TTKV"
        message={
          <Typography variant="body2">
            Xóa TTKV <strong>{deleteTarget?.code}</strong>?<br />
            Không thể xóa nếu TTKV đang được gán cho trạm.
          </Typography>
        }
        onConfirm={() => deleteCode && deleteMutation.mutate(deleteCode)}
        onClose={() => setDeleteCode(null)}
      />

      <Snackbar open={!!snack.msg} autoHideDuration={4000} onClose={() => setSnack({ msg: '' })}>
        <Alert severity={snack.sev ?? 'success'} onClose={() => setSnack({ msg: '' })}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
