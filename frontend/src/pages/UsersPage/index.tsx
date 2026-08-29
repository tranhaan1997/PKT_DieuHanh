import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, IconButton, Tooltip, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Switch, FormControlLabel, Alert,
  Button, Snackbar, useTheme, useMediaQuery,
} from '@mui/material';
import { RefreshOutlined, SyncOutlined, DeleteOutlined, EditOutlined } from '@mui/icons-material';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import api from '../../api/axios';
import type { User, UserRole } from '../../types';
import AmsSyncModal from './AmsSyncModal';
import PageHeader from '../../components/ui/PageHeader';
import Toolbar from '../../components/ui/Toolbar';
import DataGrid from '../../components/ui/DataGrid';
import MobileList from '../../components/ui/MobileList';
import StatusChip from '../../components/ui/StatusChip';
import { StatusCellRenderer, TwoLineCellRenderer, ActionsCellRenderer } from '../../components/ui/gridCells';
import { palette } from '../../theme/tokens';
import type { StatusKey } from '../../theme/tokens';

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Quản trị', SUPERVISOR: 'Điều hành', TECHNICIAN: 'Kỹ thuật', VIEWER: 'Người xem',
};

const ROLE_TONE: Record<UserRole, StatusKey> = {
  ADMIN: 'error', SUPERVISOR: 'warning', TECHNICIAN: 'neutral', VIEWER: 'info',
};

const ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'VIEWER'];

interface UserRow extends User { createdAt?: string; departmentGroup?: string }

/* ── Swipeable user card ──────────────────────────────────────────────── */
function SwipeableUserCard({ user, onEdit }: { user: UserRow; onEdit: () => void }) {
  const ACTION_W = 110;
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

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: 2.5 }}>
      {/* Action button */}
      <Box sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: ACTION_W, display: 'flex', alignItems: 'stretch' }}>
        <Button onClick={() => { snap(false); onEdit(); }} sx={{
          flex: 1, borderRadius: 0, bgcolor: palette.brand.main, color: '#fff',
          fontSize: '0.7rem', fontWeight: 700, flexDirection: 'column', gap: 0.25,
          '&:hover': { bgcolor: palette.brand.dark },
        }}>
          <EditOutlined sx={{ fontSize: 20 }} />
          Cập nhật
        </Button>
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
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: palette.text.primary }}>{user.fullName}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: palette.text.muted, mt: 0.1 }}>@{user.username}</Typography>
            {user.department && <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted, mt: 0.1 }}>{user.department}</Typography>}
          </Box>
          {/* Swipe hint */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, opacity: open ? 0 : 0.25, transition: 'opacity 0.2s', flexShrink: 0, mt: 0.25 }}>
            {[20, 14, 8].map((w) => <Box key={w} sx={{ width: w, height: 2, bgcolor: palette.text.muted, borderRadius: 1 }} />)}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
          <StatusChip label={ROLE_LABELS[user.role]} tone={ROLE_TONE[user.role]} size="sm" />
          <StatusChip label={user.active ? 'Hoạt động' : 'Vô hiệu'} tone={user.active ? 'success' : 'neutral'} size="sm" />
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted, mt: 1 }}>
          Đăng nhập gần nhất: {user.lastLogin ? new Date(user.lastLogin).toLocaleString('vi-VN') : 'Chưa đăng nhập'}
        </Typography>
      </Box>
    </Box>
  );
}

interface FormState { fullName: string; email: string; role: UserRole; department: string; departmentGroup: string; active: boolean }

/* Active toggle chip cell */
interface ActiveParams extends ICellRendererParams { onToggle: (row: UserRow) => void }
function ActiveCell(p: ActiveParams) {
  const active = p.data.active;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
      <StatusChip
        label={active ? 'Hoạt động' : 'Vô hiệu'}
        tone={active ? 'success' : 'neutral'}
        size="sm"
        onClick={() => p.onToggle(p.data)}
      />
    </Box>
  );
}

export default function UsersPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [rows, setRows]             = useState<UserRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser]     = useState<UserRow | null>(null);
  const [form, setForm]             = useState<FormState>({ fullName: '', email: '', role: 'TECHNICIAN', department: '', departmentGroup: '', active: true });
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');
  const [syncOpen, setSyncOpen]     = useState(false);
  const [snack, setSnack]           = useState('');
  const [deleting, setDeleting]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<UserRow[]>('/api/users');
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) =>
      r.username.toLowerCase().includes(q) ||
      r.fullName.toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      (r.department || '').toLowerCase().includes(q) ||
      (r.departmentGroup || '').toLowerCase().includes(q));
  }, [rows, search]);

  const openEdit = (user: UserRow) => {
    setEditUser(user);
    setForm({ fullName: user.fullName, email: user.email || '', role: user.role, department: user.department || '', departmentGroup: user.departmentGroup || '', active: user.active });
    setFormError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    setFormError('');
    try {
      const { data } = await api.put<UserRow>(`/api/users/${editUser.id}`, {
        fullName: form.fullName,
        email: form.email || undefined,
        role: form.role,
        department: form.department || undefined,
        departmentGroup: form.departmentGroup || undefined,
        active: form.active,
      });
      setRows((prev) => prev.map((r) => (r.id === data.id ? { ...r, ...data } : r)));
      setDialogOpen(false);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: UserRow) => {
    try {
      const { data } = await api.put<UserRow>(`/api/users/${user.id}`, { active: !user.active });
      setRows((prev) => prev.map((r) => (r.id === user.id ? { ...r, ...data } : r)));
    } catch (err: any) {
      setSnack(err.response?.data?.message || 'Lỗi cập nhật trạng thái');
    }
  };

  const handleDelete = async () => {
    if (!editUser) return;
    setDeleting(true);
    setFormError('');
    try {
      await api.delete(`/api/users/${editUser.id}`);
      setRows((prev) => prev.filter((r) => r.id !== editUser.id));
      setDialogOpen(false);
      setConfirmDelete(false);
      setSnack('Đã xóa tài khoản');
    } catch (err: any) {
      setConfirmDelete(false);
      const raw = err.response?.data?.message;
      const msg = typeof raw === 'object' ? (raw?.message ?? JSON.stringify(raw)) : (raw ?? 'Không thể xóa');
      setFormError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      field: 'fullName', headerName: 'Họ tên', flex: 1.4, minWidth: 180,
      cellRenderer: TwoLineCellRenderer,
      cellRendererParams: { getPrimary: (r: UserRow) => r.fullName, getSecondary: (r: UserRow) => `@${r.username}` },
    },
    {
      field: 'email', headerName: 'Email', flex: 1.4, minWidth: 190,
      valueFormatter: (p) => p.value || '—',
    },
    {
      field: 'department', headerName: 'Phòng ban', flex: 1, minWidth: 150,
      valueFormatter: (p) => p.value || '—',
    },
    {
      field: 'departmentGroup', headerName: 'TTKV', flex: 0.8, minWidth: 120,
      valueFormatter: (p) => p.value || '—',
    },
    {
      field: 'role', headerName: 'Vai trò', width: 130, filter: false,
      cellRenderer: StatusCellRenderer,
      cellRendererParams: { toneMap: ROLE_TONE, labelMap: ROLE_LABELS },
    },
    {
      field: 'active', headerName: 'Trạng thái', width: 130, filter: false,
      cellRenderer: ActiveCell,
      cellRendererParams: { onToggle: handleToggleActive },
    },
    {
      field: 'lastLogin', headerName: 'Đăng nhập gần nhất', width: 170, filter: false,
      valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString('vi-VN') : 'Chưa đăng nhập'),
    },
    {
      headerName: '', width: 70, pinned: 'right', sortable: false, filter: false, resizable: false,
      cellRenderer: ActionsCellRenderer,
      cellRendererParams: { onEdit: (row: UserRow) => openEdit(row) },
    },
  ], []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: { xs: 'calc(100dvh - 148px)', md: 'calc(100vh - 102px)' } }}>
      {!isMobile && (
        <PageHeader
          title="Quản lý người dùng"
          subtitle={`${rows.length} tài khoản`}
          actions={
            <Button variant="contained" startIcon={<SyncOutlined />} onClick={() => setSyncOpen(true)}>
              Đồng bộ AMS
            </Button>
          }
        />
      )}

      <Toolbar
        search={search} onSearch={setSearch} searchPlaceholder="Tìm tên, email, phòng ban..." searchWidth={300}
        endSlot={
          <Tooltip title="Tải lại" arrow>
            <IconButton onClick={load} size="small" sx={{ border: `1px solid ${palette.border}`, borderRadius: 1.25 }}>
              <RefreshOutlined sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        }
      />

      {!isMobile && (
        <DataGrid
          rowData={filtered}
          columnDefs={columnDefs}
          loading={loading}
          rowHeight={52}
          pagination
          paginationPageSize={25}
          paginationPageSizeSelector={[25, 50, 100]}
        />
      )}

      {isMobile && (
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <MobileList loading={loading} count={filtered.length}>
            {filtered.map((user) => (
              <SwipeableUserCard key={user.id} user={user} onEdit={() => openEdit(user)} />
            ))}
          </MobileList>
        </Box>
      )}

      {/* Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Chỉnh sửa — {editUser?.fullName}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {formError && <Alert severity="error" onClose={() => setFormError('')}>{formError}</Alert>}

          <TextField label="Họ và tên" size="small" fullWidth required
            value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          <TextField label="Email" size="small" fullWidth type="email"
            value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            helperText="Được đồng bộ tự động từ AMS khi đăng nhập" />
          <TextField label="Phòng ban" size="small" fullWidth
            value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            helperText="Được đồng bộ tự động từ AMS khi đăng nhập" />
          <TextField label="TTKV" size="small" fullWidth
            value={form.departmentGroup} onChange={(e) => setForm((f) => ({ ...f, departmentGroup: e.target.value }))}
            helperText="Được đồng bộ tự động từ AMS (DEPT_GROUP)" />
          <TextField select label="Vai trò" size="small" fullWidth
            value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}>
            {ROLES.map((r) => <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>)}
          </TextField>
          <FormControlLabel
            control={<Switch checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />}
            label={form.active ? 'Đang hoạt động' : 'Bị vô hiệu hóa'}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          {!confirmDelete ? (
            <>
              <Button color="error" startIcon={<DeleteOutlined />} onClick={() => setConfirmDelete(true)} disabled={saving || deleting} sx={{ mr: 'auto' }}>
                Xóa tài khoản
              </Button>
              <Button onClick={() => setDialogOpen(false)} disabled={saving}>Huỷ</Button>
              <Button variant="contained" onClick={handleSave} disabled={saving || !form.fullName}>
                {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
              </Button>
            </>
          ) : (
            <>
              <Alert severity="warning" sx={{ flex: 1, py: 0.5 }}>
                Xóa vĩnh viễn tài khoản <strong>{editUser?.fullName}</strong>?
              </Alert>
              <Button onClick={() => setConfirmDelete(false)} disabled={deleting}>Không</Button>
              <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Đang xóa…' : 'Xóa'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <AmsSyncModal open={syncOpen} onClose={() => setSyncOpen(false)} onSynced={() => { load(); setSnack('Đồng bộ AMS hoàn tất'); }} />

      <Snackbar open={Boolean(snack)} autoHideDuration={5000} onClose={() => setSnack('')} message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}
