import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Box, Button, FormControl, InputLabel, Select, MenuItem,
  Alert, Snackbar, Drawer, Stack, Typography, Divider,
  TextField, IconButton, Tooltip, Tabs, Tab, Chip, InputAdornment,
  useMediaQuery, useTheme,
} from '@mui/material';
import { Close, Assignment, Construction, SearchOutlined, ClearOutlined, HistoryOutlined } from '@mui/icons-material';
import type { ColDef, ColGroupDef, ICellRendererParams } from 'ag-grid-community';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWorkOrders, updateWorkOrder, getWorkOrderLogs } from '../../api/workOrders';
import { getApiErrorMessage } from '../../api/axios';
import type { WorkOrderLog } from '../../api/workOrders';
import { getPeriods, getPeriod } from '../../api/periods';
import type { WorkOrder } from '../../types';
import DataGrid from '../../components/ui/DataGrid';
import MobileList from '../../components/ui/MobileList';
import LongPressCopy from '../../components/common/LongPressCopy';
import { useAuth } from '../../hooks/useAuth';
import { status, palette } from '../../theme/tokens';

const STATUS_LABELS: Record<string, string> = {
  EMPTY: 'Trống', WRITTEN: 'Đã viết',
  RECEIVED: 'Đã nhận', TRANSFERRED: 'Đã chuyển',
  NOT_STARTED: 'Chưa TH', IN_PROGRESS: 'Đang TH', COMPLETED: 'Hoàn thành', CANCELLED: 'Hủy',
  NOT_TAKEN: 'Chưa chụp', TAKEN: 'Đã chụp',
};

const WRITTEN_OPTS  = [{ value: 'EMPTY', label: 'Trống' }, { value: 'WRITTEN', label: 'Đã viết' }];
const MATERIAL_OPTS = [{ value: 'EMPTY', label: 'Trống' }, { value: 'RECEIVED', label: 'Đã nhận' }, { value: 'TRANSFERRED', label: 'Đã chuyển' }];
const INSTALL_OPTS  = [{ value: 'NOT_STARTED', label: 'Chưa TH' }, { value: 'IN_PROGRESS', label: 'Đang TH' }, { value: 'COMPLETED', label: 'Hoàn thành' }, { value: 'CANCELLED', label: 'Hủy' }];
const PHOTO_OPTS    = [{ value: 'NOT_TAKEN', label: 'Chưa chụp' }, { value: 'TAKEN', label: 'Đã chụp' }];

type DrawerMode = 'office' | 'tech' | 'log' | null;

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

function DrawerHeader({ wo, onClose }: { wo: WorkOrder; onClose: () => void }) {
  return (
    <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{wo.site?.siteCode}</Typography>
        <Typography variant="body2" color="text.secondary">{wo.solution?.solutionName}</Typography>
        <Typography variant="caption" color="text.secondary">{wo.ticketNo} · {wo.site?.ttkvCode} · {wo.site?.province}</Typography>
      </Box>
      <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
    </Box>
  );
}

function OfficeDrawer({ wo, onClose, onSave, readOnly }: { wo: WorkOrder; onClose: () => void; onSave: (c: Partial<WorkOrder>) => void; readOnly?: boolean }) {
  const [form, setForm] = useState({
    writtenTicket: wo.writtenTicket,
    actReceivedMaterial: wo.actReceivedMaterial,
    ttkvReceivedMaterial: wo.ttkvReceivedMaterial,
    siteReceivedMaterial: wo.siteReceivedMaterial,
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DrawerHeader wo={wo} onClose={onClose} />
      <Box sx={{ p: 2, flex: 1, overflowY: 'auto' }}>
        <Stack spacing={2}>
          {readOnly && (
            <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>Kỳ đã đóng — chỉ xem, không thể cập nhật.</Alert>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assignment fontSize="small" color="primary" />
            <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Phiếu &amp; Vật tư</Typography>
          </Box>
          <SelectField label="Viết phiếu" value={form.writtenTicket} onChange={(v) => set('writtenTicket', v)} options={WRITTEN_OPTS} disabled={readOnly} />
          <SelectField label="TS ACT nhận VT" value={form.actReceivedMaterial} onChange={(v) => set('actReceivedMaterial', v)} options={MATERIAL_OPTS} disabled={readOnly} />
          <SelectField label="TTKV nhận VT" value={form.ttkvReceivedMaterial} onChange={(v) => set('ttkvReceivedMaterial', v)} options={MATERIAL_OPTS} disabled={readOnly} />
          <SelectField label="VT lên trạm" value={form.siteReceivedMaterial} onChange={(v) => set('siteReceivedMaterial', v)} options={MATERIAL_OPTS} disabled={readOnly} />
        </Stack>
      </Box>
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>Đóng</Button>
        {!readOnly && (
          <Button variant="contained" startIcon={<Assignment />} onClick={() => onSave(form)}>Lưu</Button>
        )}
      </Box>
    </Box>
  );
}

function TechDrawer({ wo, onClose, onSave, readOnly }: { wo: WorkOrder; onClose: () => void; onSave: (c: Partial<WorkOrder>) => void; readOnly?: boolean }) {
  const [form, setForm] = useState({
    planDate: wo.planDate?.substring(0, 10) || '',
    executorName: wo.executorName || '',
    installationStatus: wo.installationStatus,
    photoStatus: wo.photoStatus,
    integrationStatus: wo.integrationStatus,
    completedDate: wo.completedDate?.substring(0, 10) || '',
    note: wo.note || '',
    issue: wo.issue || '',
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const handleSave = () => {
    const payload: any = { ...form };
    payload.planDate = payload.planDate || null;
    payload.completedDate = payload.completedDate || null;
    onSave(payload);
  };
  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DrawerHeader wo={wo} onClose={onClose} />
      <Box sx={{ p: 2, flex: 1, overflowY: 'auto' }}>
        <Stack spacing={2}>
          {readOnly && (
            <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>Kỳ đã đóng — chỉ xem, không thể cập nhật.</Alert>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Construction fontSize="small" color="warning" />
            <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Kế hoạch &amp; Nhân sự</Typography>
          </Box>
          <TextField size="small" fullWidth label="Kế hoạch thực hiện" type="date" disabled={readOnly}
            slotProps={{ inputLabel: { shrink: true } }}
            value={form.planDate} onChange={(e) => set('planDate', e.target.value)} />
          <TextField size="small" fullWidth label="Nhân sự thực hiện" disabled={readOnly}
            value={form.executorName} onChange={(e) => set('executorName', e.target.value)} />
          <Divider />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Construction fontSize="small" color="warning" />
            <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tiến độ thi công</Typography>
          </Box>
          <SelectField label="Lắp đặt" value={form.installationStatus} onChange={(v) => set('installationStatus', v)} options={INSTALL_OPTS} disabled={readOnly} />
          <SelectField label="Chụp hình" value={form.photoStatus} onChange={(v) => set('photoStatus', v)} options={PHOTO_OPTS} disabled={readOnly} />
          <SelectField label="Tích hợp" value={form.integrationStatus} onChange={(v) => set('integrationStatus', v)} options={INSTALL_OPTS} disabled={readOnly} />
          <TextField size="small" fullWidth label="Ngày hoàn thành" type="date" disabled={readOnly}
            slotProps={{ inputLabel: { shrink: true } }}
            value={form.completedDate} onChange={(e) => set('completedDate', e.target.value)} />
          <Divider />
          <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ghi chú</Typography>
          <TextField size="small" fullWidth multiline rows={3} label="Ghi chú" disabled={readOnly}
            value={form.note} onChange={(e) => set('note', e.target.value)} />
          <TextField size="small" fullWidth multiline rows={3} label="Vướng mắc" disabled={readOnly}
            value={form.issue} onChange={(e) => set('issue', e.target.value)}
            sx={form.issue ? { '& .MuiOutlinedInput-root': { background: status.warning.bg } } : {}} />
        </Stack>
      </Box>
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>Đóng</Button>
        {!readOnly && (
          <Button variant="contained" color="warning" startIcon={<Construction />} onClick={handleSave}>Lưu</Button>
        )}
      </Box>
    </Box>
  );
}

// ── Solution group colour palette (header bg, subtle cell tint) ───────────
const GROUP_COLORS = [
  { header: '#1D4ED8', headerText: '#fff', cellBg: '#EFF6FF' },  // blue
  { header: '#7C3AED', headerText: '#fff', cellBg: '#F5F3FF' },  // violet
  { header: '#0891B2', headerText: '#fff', cellBg: '#ECFEFF' },  // cyan
  { header: '#B45309', headerText: '#fff', cellBg: '#FFFBEB' },  // amber
  { header: '#047857', headerText: '#fff', cellBg: '#F0FDF4' },  // green
  { header: '#BE185D', headerText: '#fff', cellBg: '#FDF2F8' },  // pink
  { header: '#9A3412', headerText: '#fff', cellBg: '#FFF7ED' },  // orange
];

// ── Helper: build column group for one solution ────────────────────────────
function makeSolutionGroup(
  solId: number, solName: string,
  onOffice: (wo: WorkOrder) => void, onTech: (wo: WorkOrder) => void,
  colorIdx: number,
): ColGroupDef {
  const f = (prop: string) => `sol_${solId}.${prop}`;
  const col = GROUP_COLORS[colorIdx % GROUP_COLORS.length];
  const cellBg = col.cellBg;
  return {
    headerName: solName,
    marryChildren: true,
    headerClass: `sol-group-${colorIdx % GROUP_COLORS.length}`,
    children: [
      {
        headerName: '', width: 76, sortable: false, filter: false, resizable: false,
        cellStyle: () => ({ background: cellBg }),
        cellRenderer: (p: ICellRendererParams) => {
          const sol = p.data[`sol_${solId}`];
          if (!sol) return null;
          const officeReady = sol._wo.siteReceivedMaterial === 'TRANSFERRED';
          return (
            <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center', height: '100%' }}>
              <Tooltip title="Phiếu & Vật tư">
                <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); onOffice(sol._wo); }}>
                  <Assignment sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={officeReady ? 'Thi công' : 'Chờ vật tư lên trạm'}>
                <span>
                  <IconButton
                    size="small"
                    color="warning"
                    disabled={!officeReady}
                    onClick={(e) => { e.stopPropagation(); if (officeReady) onTech(sol._wo); }}
                  >
                    <Construction sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          );
        },
      },
      {
        field: f('writtenTicket'), headerName: 'Viết phiếu', width: 105, filter: false, sortable: false,
        valueFormatter: (p) => p.value === 'EMPTY' ? '' : (STATUS_LABELS[p.value] ?? p.value),
        cellStyle: (p) => p.value === 'WRITTEN' ? { background: status.success.bg } : { background: cellBg },
      },
      {
        field: f('actReceivedMaterial'), headerName: 'ACT nhận VT', width: 115, filter: false, sortable: false,
        valueFormatter: (p) => p.value === 'EMPTY' ? '' : (STATUS_LABELS[p.value] ?? p.value),
        cellStyle: (p) => p.value === 'RECEIVED' ? { background: status.success.bg } : { background: cellBg },
      },
      {
        field: f('ttkvReceivedMaterial'), headerName: 'TTKV nhận VT', width: 115, filter: false, sortable: false,
        valueFormatter: (p) => p.value === 'EMPTY' ? '' : (STATUS_LABELS[p.value] ?? p.value),
        cellStyle: (p) => p.value === 'TRANSFERRED' ? { background: status.success.bg } : { background: cellBg },
      },
      {
        field: f('siteReceivedMaterial'), headerName: 'VT lên trạm', width: 115, filter: false, sortable: false,
        valueFormatter: (p) => p.value === 'EMPTY' ? '' : (STATUS_LABELS[p.value] ?? p.value),
        cellStyle: (p) => p.value === 'TRANSFERRED' ? { background: status.success.bg } : { background: cellBg },
      },
      {
        field: f('installationStatus'), headerName: 'Lắp đặt', width: 100, filter: false, sortable: false,
        valueFormatter: (p) => p.value === 'NOT_STARTED' ? '' : (STATUS_LABELS[p.value] ?? p.value),
        cellStyle: (p) => {
          if (p.value === 'COMPLETED') return { background: status.success.bg };
          if (p.value === 'IN_PROGRESS') return { background: status.info.bg };
          if (p.value === 'CANCELLED') return { background: status.error.bg };
          return { background: cellBg };
        },
      },
      {
        field: f('integrationStatus'), headerName: 'Tích hợp', width: 100, filter: false, sortable: false,
        valueFormatter: (p) => p.value === 'NOT_STARTED' ? '' : (STATUS_LABELS[p.value] ?? p.value),
        cellStyle: (p) => {
          if (p.value === 'COMPLETED') return { background: status.success.bg };
          if (p.value === 'IN_PROGRESS') return { background: status.info.bg };
          if (p.value === 'CANCELLED') return { background: status.error.bg };
          return { background: cellBg };
        },
      },
      {
        field: f('issue'), headerName: 'Vướng mắc', width: 150, filter: false, sortable: false,
        tooltipField: f('issue'),
        cellStyle: (p) => p.value ? { background: status.warning.bg } : { background: cellBg },
      },
    ],
  };
}

// ── Status display helpers ─────────────────────────────────────────────────
type Tone = { color: string; bg: string; dot: string };
const T: Record<string, Tone> = {
  done:    { color: '#16A34A', bg: '#F0FDF4', dot: '#16A34A' },
  partial: { color: '#2563EB', bg: '#EFF6FF', dot: '#2563EB' },
  warn:    { color: '#D97706', bg: '#FFFBEB', dot: '#D97706' },
  empty:   { color: '#94A3B8', bg: '#F8FAFC', dot: '#CBD5E1' },
  err:     { color: '#DC2626', bg: '#FEF2F2', dot: '#DC2626' },
};

function StatusRow({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: tone.dot, flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.7rem', color: '#64748B', width: 90, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: tone.color }}>{value}</Typography>
    </Box>
  );
}

const WRITTEN_INFO: Record<string, [string, Tone]> = {
  EMPTY:   ['Chưa viết', T.empty],
  WRITTEN: ['Đã viết',   T.done],
};
const MATERIAL_INFO: Record<string, [string, Tone]> = {
  EMPTY:       ['Chưa nhận',  T.empty],
  RECEIVED:    ['Đã nhận',    T.done],
  TRANSFERRED: ['Đã chuyển', T.partial],
};
const INSTALL_INFO: Record<string, [string, Tone]> = {
  NOT_STARTED: ['Chưa thực hiện', T.empty],
  IN_PROGRESS: ['Đang thực hiện', T.partial],
  COMPLETED:   ['Hoàn thành',     T.done],
  CANCELLED:   ['Hủy',            T.err],
};
const PHOTO_INFO: Record<string, [string, Tone]> = {
  NOT_TAKEN: ['Chưa chụp', T.empty],
  TAKEN:     ['Đã chụp',   T.done],
};

// ── Swipeable WO card (mobile) ─────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  writtenTicket: 'Viết phiếu', actReceivedMaterial: 'ACT nhận VT', ttkvReceivedMaterial: 'TTKV nhận VT', siteReceivedMaterial: 'VT lên trạm',
  planDate: 'Ngày kế hoạch', executorName: 'Nhân sự TH', installationStatus: 'Lắp đặt',
  photoStatus: 'Chụp hình', integrationStatus: 'Tích hợp', note: 'Ghi chú', issue: 'Vướng mắc', completedDate: 'Ngày hoàn thành',
};

function formatLogValue(field: string, val: string | null): string {
  if (val === null || val === '') return '(trống)';
  if (field.endsWith('Date') && val.includes('T')) return new Date(val).toLocaleString('vi-VN');
  return STATUS_LABELS[val] ?? val;
}

function LogDrawer({ wo, onClose }: { wo: WorkOrder; onClose: () => void }) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['wo-logs', wo.id],
    queryFn: () => getWorkOrderLogs(wo.id).then((r) => r.data),
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <HistoryOutlined sx={{ color: '#475569' }} />
        <Typography sx={{ flex: 1, fontWeight: 700 }}>Lịch sử cập nhật</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>{wo.ticketNo}</Typography>
        <IconButton size="small" onClick={onClose}><Close fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {isLoading && <Typography sx={{ color: '#94A3B8', fontSize: '0.85rem' }}>Đang tải…</Typography>}
        {!isLoading && !logs?.length && (
          <Typography sx={{ color: '#94A3B8', fontSize: '0.85rem', textAlign: 'center', mt: 4 }}>Chưa có lịch sử cập nhật</Typography>
        )}
        {logs?.map((log: WorkOrderLog) => (
          <Box key={log.id} sx={{ mb: 2.5, position: 'relative', pl: 2, '&::before': { content: '""', position: 'absolute', left: 0, top: 6, bottom: -10, width: 2, bgcolor: '#E2E8F0' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#475569', position: 'absolute', left: -3 }} />
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#1E293B' }}>{log.user.fullName}</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#94A3B8' }}>({log.user.role})</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.68rem', color: '#94A3B8', mb: 0.75 }}>
              {new Date(log.createdAt).toLocaleString('vi-VN')}
            </Typography>
            <Box sx={{ bgcolor: '#F8FAFC', borderRadius: 1.5, p: 1, border: '1px solid #E2E8F0' }}>
              {Object.entries(log.changes).map(([field, { from, to }]) => (
                <Box key={field} sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5, '&:last-child': { mb: 0 } }}>
                  <Typography sx={{ fontSize: '0.7rem', color: '#64748B', minWidth: 100 }}>{FIELD_LABELS[field] ?? field}:</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#DC2626', textDecoration: 'line-through' }}>{formatLogValue(field, from)}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#64748B' }}>→</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#16A34A', fontWeight: 600 }}>{formatLogValue(field, to)}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SwipeableWOCard({
  wo, role, onOffice, onTech, onLog,
}: {
  wo: WorkOrder & { site?: any; solution?: any };
  role: string;
  onOffice: () => void;
  onTech: () => void;
  onLog: () => void;
}) {
  const isTech = role === 'TECHNICIAN';

  // Chỉ cho cập nhật thi công khi vật tư đã chuyển lên trạm
  const officeReady = wo.siteReceivedMaterial === 'TRANSFERRED';

  const ACTION_W = isTech ? 184 : 290;

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
    dragging.current = true;
    locked.current = null;
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

  const [wt, wtTone]   = WRITTEN_INFO[wo.writtenTicket]       ?? WRITTEN_INFO.EMPTY;
  const [ar, arTone]   = MATERIAL_INFO[wo.actReceivedMaterial] ?? MATERIAL_INFO.EMPTY;
  const [tr, trTone]   = MATERIAL_INFO[wo.ttkvReceivedMaterial] ?? MATERIAL_INFO.EMPTY;
  const [sr, srTone]   = MATERIAL_INFO[wo.siteReceivedMaterial] ?? MATERIAL_INFO.EMPTY;
  const [inst, instTone] = INSTALL_INFO[wo.installationStatus] ?? INSTALL_INFO.NOT_STARTED;
  const [intg, intgTone] = INSTALL_INFO[wo.integrationStatus]  ?? INSTALL_INFO.NOT_STARTED;
  const [photo, photoTone] = PHOTO_INFO[wo.photoStatus]        ?? PHOTO_INFO.NOT_TAKEN;

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: 2.5 }}>
      {/* ── Action buttons (behind card) ── */}
      <Box sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: ACTION_W, display: 'flex', alignItems: 'stretch' }}>
        {!isTech && (
          <Button onClick={() => { snap(false); onOffice(); }} sx={{
            flex: 1, borderRadius: 0, bgcolor: palette.brand.main, color: '#fff',
            fontSize: '0.68rem', fontWeight: 700, minWidth: 0,
            flexDirection: 'column', gap: 0.25, lineHeight: 1.2,
            '&:hover': { bgcolor: palette.brand.dark },
          }}>
            <Assignment sx={{ fontSize: 20 }} />
            Cập nhật phiếu
          </Button>
        )}
        <Button
          onClick={() => { if (!officeReady) return; snap(false); onTech(); }}
          sx={{
            flex: 1, borderRadius: 0,
            bgcolor: officeReady ? '#D97706' : '#94A3B8',
            color: '#fff', fontSize: '0.68rem', fontWeight: 700, minWidth: 0,
            flexDirection: 'column', gap: 0.25, lineHeight: 1.2,
            cursor: officeReady ? 'pointer' : 'not-allowed',
            '&:hover': { bgcolor: officeReady ? '#B45309' : '#94A3B8' },
          }}
        >
          <Construction sx={{ fontSize: 20 }} />
          {officeReady ? 'Cập nhật thi công' : 'Chờ vật tư lên trạm'}
        </Button>
        <Button onClick={() => { snap(false); onLog(); }} sx={{
          width: 74, borderRadius: 0, bgcolor: '#475569', color: '#fff',
          fontSize: '0.68rem', fontWeight: 700, minWidth: 0,
          flexDirection: 'column', gap: 0.25, lineHeight: 1.2,
          '&:hover': { bgcolor: '#334155' },
        }}>
          <HistoryOutlined sx={{ fontSize: 20 }} />
          Lịch sử
        </Button>
      </Box>

      {/* ── Card (slides left) ── */}
      <Box
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => open && snap(false)}
        sx={{
          position: 'relative', zIndex: 1,
          transform: `translateX(${offset}px)`,
          transition: dragging.current ? 'none' : 'transform 0.22s ease',
          bgcolor: palette.card,
          border: `1px solid ${palette.border}`,
          borderRadius: 2.5,
          p: 1.5,
          userSelect: 'none',
          touchAction: 'pan-y',
        }}
      >
        {/* Header row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1.25 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: palette.text.primary, lineHeight: 1.3 }}>
              <LongPressCopy value={wo.site?.siteCode}>{wo.site?.siteCode}</LongPressCopy>
              <Box component="span" sx={{ ml: 1, fontSize: '0.75rem', fontWeight: 500, color: palette.text.muted }}>
                {wo.ticketNo}
              </Box>
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: palette.brand.main, fontWeight: 600, mt: 0.15 }}>
              {wo.solution?.solutionName}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted, mt: 0.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {wo.site?.province}
            </Typography>
          </Box>
          {/* Swipe hint */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, opacity: open ? 0 : 0.25, transition: 'opacity 0.2s', flexShrink: 0, mt: 0.5 }}>
            {[20, 14, 8].map((w) => <Box key={w} sx={{ width: w, height: 2, bgcolor: palette.text.muted, borderRadius: 1 }} />)}
          </Box>
        </Box>

        {/* ── Phiếu & Vật tư ── */}
        <Box sx={{ bgcolor: officeReady ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${officeReady ? '#BBF7D0' : palette.border}`, borderRadius: 1.5, p: 1, mb: 1 }}>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: officeReady ? '#16A34A' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.75 }}>
            {officeReady ? '✓ Phiếu & Vật tư' : '⚠ Phiếu & Vật tư — chưa đủ'}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <StatusRow label="Viết phiếu"    value={wt}   tone={wtTone} />
            <StatusRow label="ACT nhận VT"   value={ar}   tone={arTone} />
            <StatusRow label="TTKV nhận VT"  value={tr}   tone={trTone} />
            <StatusRow label="VT lên trạm"   value={sr}   tone={srTone} />
          </Box>
        </Box>

        {/* ── Thi công ── */}
        <Box sx={{ bgcolor: '#FAFAFA', border: `1px solid ${palette.border}`, borderRadius: 1.5, p: 1 }}>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.75 }}>
            Thi công
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <StatusRow label="Lắp đặt"   value={inst}  tone={instTone} />
            <StatusRow label="Tích hợp"  value={intg}  tone={intgTone} />
            <StatusRow label="Chụp hình" value={photo} tone={photoTone} />
          </Box>
        </Box>

        {/* Extra info */}
        {(wo.executorName || wo.note || wo.issue) && (
          <Box sx={{ mt: 0.75, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {wo.executorName && (
              <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted }}>Nhân sự: {wo.executorName}</Typography>
            )}
            {wo.note && (
              <Typography sx={{ fontSize: '0.68rem', color: '#475569', lineHeight: 1.3 }}>
                <Box component="span" sx={{ fontWeight: 600 }}>GC: </Box>{wo.note}
              </Typography>
            )}
            {wo.issue && (
              <Typography sx={{ fontSize: '0.68rem', color: '#D97706', fontWeight: 600, lineHeight: 1.3 }}>⚠ {wo.issue}</Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function WorkOrdersPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [activeWO, setActiveWO] = useState<WorkOrder | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [woSiteSearch, setWoSiteSearch] = useState('');
  const [snack, setSnack] = useState<{ msg: string; sev?: 'success' | 'error' }>({ msg: '' });
  const MOBILE_PAGE_SIZE = 30;
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_PAGE_SIZE);

  useEffect(() => { setMobileVisibleCount(MOBILE_PAGE_SIZE); }, [activeTab, woSiteSearch]);

  const openDrawer = useCallback((wo: WorkOrder, mode: DrawerMode) => { setActiveWO(wo); setDrawerMode(mode); }, []);
  const closeDrawer = useCallback(() => { setActiveWO(null); setDrawerMode(null); }, []);

  const { data: periodsData } = useQuery({ queryKey: ['periods'], queryFn: () => getPeriods().then((r) => r.data) });
  const activePeriods = periodsData?.filter((p) => p.status === 'ACTIVE') ?? [];

  useEffect(() => {
    if (activePeriods.length && !selectedPeriodId) {
      setSelectedPeriodId(String(activePeriods[0].id));
    }
  }, [activePeriods.length]);

  const queryParams = useMemo(() => {
    if (!selectedPeriodId) return null;
    return { periodId: selectedPeriodId, limit: '1000' };
  }, [selectedPeriodId]);

  const { data: allWOs, isLoading } = useQuery({
    queryKey: ['work-orders', queryParams],
    queryFn: () => getWorkOrders(queryParams!).then((r) => r.data.data),
    enabled: !!queryParams,
  });

  const { data: selectedPeriodDetail } = useQuery({
    queryKey: ['period', selectedPeriodId ? +selectedPeriodId : null],
    queryFn: () => getPeriod(+selectedPeriodId).then((r) => r.data),
    enabled: !!selectedPeriodId,
  });
  const isPeriodClosed = (selectedPeriodDetail as any)?.status === 'CLOSED';
  const isViewer = user?.role === 'VIEWER';

  // ── TTKV tabs ────────────────────────────────────────────────────────────
  const ttkvTabs = useMemo(() => {
    if (!allWOs?.length) return [];
    const s = new Set<string>();
    allWOs.forEach((wo: any) => { if (wo.site?.ttkvCode) s.add(wo.site.ttkvCode); });
    return Array.from(s).sort();
  }, [allWOs]);

  useEffect(() => {
    if (ttkvTabs.length && !ttkvTabs.includes(activeTab)) setActiveTab(ttkvTabs[0]);
  }, [ttkvTabs.join(',')]);

  // ── Pivot: flat WOs → 1 row/site, solutions as columns ─────────────────
  const { rowData, solutionGroups } = useMemo(() => {
    const wos = (allWOs || []).filter((wo: any) => wo.site?.ttkvCode === activeTab);

    const solMap = new Map<number, { id: number; solutionName: string }>();
    wos.forEach((wo: any) => {
      if (!solMap.has(wo.solutionId)) {
        solMap.set(wo.solutionId, { id: wo.solutionId, solutionName: wo.solution?.solutionName ?? '' });
      }
    });

    const siteMap = new Map<number, any>();
    wos.forEach((wo: any) => {
      if (!siteMap.has(wo.siteId)) {
        siteMap.set(wo.siteId, {
          siteId: wo.siteId,
          siteCode: wo.site?.siteCode,
          siteName: wo.site?.siteName,
          province: wo.site?.province,
          ttkvCode: wo.site?.ttkvCode,
        });
      }
      const row = siteMap.get(wo.siteId);
      row[`sol_${wo.solutionId}`] = {
        _wo: wo,
        writtenTicket: wo.writtenTicket,
        actReceivedMaterial: wo.actReceivedMaterial,
        ttkvReceivedMaterial: wo.ttkvReceivedMaterial,
        siteReceivedMaterial: wo.siteReceivedMaterial,
        installationStatus: wo.installationStatus,
        integrationStatus: wo.integrationStatus,
        issue: wo.issue,
      };
    });

    // Sort solution columns by the order defined in period detail
    const periodSolOrder = (selectedPeriodDetail?.periodSolutions ?? []).map((ps: any) => ps.solution.id as number);
    const rawGroups = Array.from(solMap.values());
    const sortedGroups = periodSolOrder.length
      ? [...rawGroups].sort((a, b) => {
          const ia = periodSolOrder.indexOf(a.id);
          const ib = periodSolOrder.indexOf(b.id);
          return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        })
      : rawGroups;

    return {
      rowData: Array.from(siteMap.values()),
      solutionGroups: sortedGroups,
    };
  }, [allWOs, activeTab, selectedPeriodDetail]);

  // ── Column defs ──────────────────────────────────────────────────────────
  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    const fixed: ColDef[] = [
      { field: 'siteCode', headerName: 'Mã trạm', width: 115, pinned: 'left' },

      { field: 'province', headerName: 'Tỉnh/Thành', width: 120, pinned: 'left', hide: true },
    ];
    const solCols = solutionGroups.map((s, idx) =>
      makeSolutionGroup(s.id, s.solutionName, (wo) => openDrawer(wo, 'office'), (wo) => openDrawer(wo, 'tech'), idx)
    );
    return [...fixed, ...solCols];
  }, [solutionGroups, openDrawer]);

  // ── Cache update after save ──────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<WorkOrder> }) => updateWorkOrder(id, changes),
    onSuccess: (_, { id, changes }) => {
      qc.setQueriesData<WorkOrder[]>({ queryKey: ['work-orders'] }, (old) =>
        old ? old.map((wo) => wo.id === id ? { ...wo, ...changes } : wo) : old
      );
      setSnack({ msg: 'Đã lưu' });
      closeDrawer();
    },
    onError: (err) => setSnack({ msg: getApiErrorMessage(err, 'Lỗi khi lưu'), sev: 'error' }),
  });

  const handleSave = useCallback((changes: Partial<WorkOrder>) => {
    if (!activeWO) return;
    updateMutation.mutate({ id: activeWO.id, changes });
  }, [activeWO]);


  // Inject header-group colour classes
  const groupColorStyle = GROUP_COLORS.map((c, i) =>
    `.ag-header-group-cell.sol-group-${i} { background-color: ${c.header} !important; color: ${c.headerText} !important; border-right: 2px solid rgba(255,255,255,0.25) !important; }`
  ).join('\n');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, height: { xs: 'calc(100dvh - 148px)', md: 'calc(100vh - 102px)' } }}>
      <style>{groupColorStyle}</style>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel>Kỳ thực hiện</InputLabel>
          <Select value={selectedPeriodId} label="Kỳ thực hiện"
            onChange={(e) => setSelectedPeriodId(e.target.value)}>
            {activePeriods.map((p) => <MenuItem key={p.id} value={String(p.id)}>{p.periodName}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {/* Stats bar */}
      {allWOs && (
        <Box sx={{ py: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>{rowData.length}</strong> trạm · <strong>{allWOs.filter((wo: any) => wo.site?.ttkvCode === activeTab).length}</strong> Phiếu thi công
          </Typography>
        </Box>
      )}

      {/* Tabs + Grid */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {ttkvTabs.length > 0 && (
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40, '& .MuiTab-root': { minHeight: 40, py: 0.5 } }}>
            {ttkvTabs.map((ttkv) => {
              const count = allWOs?.filter((wo: any) => wo.site?.ttkvCode === ttkv).length ?? 0;
              return (
                <Tab key={ttkv} value={ttkv} label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {ttkv}
                    <Chip label={count} size="small" sx={{ height: 18, fontSize: 11 }} />
                  </Box>
                } />
              );
            })}
          </Tabs>
        )}
        <Box sx={{ flex: 1, minHeight: 0, pt: 1, display: 'flex', flexDirection: 'column' }}>
          {!isMobile && (
            <DataGrid
              rowData={rowData}
              columnDefs={columnDefs}
              loading={isLoading}
              tooltipShowDelay={400}
              tooltipHideDelay={3000}
              getRowId={(p) => String(p.data.siteId)}
            />
          )}
          {isMobile && (
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {/* Search by site code */}
              <Box sx={{ px: 0.25, pt: 0.5, pb: 1 }}>
                <TextField
                  size="small" fullWidth
                  placeholder="Lọc theo mã trạm..."
                  value={woSiteSearch}
                  onChange={(e) => setWoSiteSearch(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start"><SearchOutlined sx={{ fontSize: 18, color: palette.text.muted }} /></InputAdornment>,
                      endAdornment: woSiteSearch ? (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setWoSiteSearch('')}><ClearOutlined sx={{ fontSize: 16 }} /></IconButton>
                        </InputAdornment>
                      ) : null,
                    },
                  }}
                />
              </Box>
              {/* Card list */}
              <Box sx={{ overflowY: 'auto', flex: 1 }}>
                {(() => {
                  const filtered = (allWOs || []).filter((wo: any) => {
                    if (wo.site?.ttkvCode !== activeTab) return false;
                    if (woSiteSearch) {
                      const q = woSiteSearch.toLowerCase();
                      return wo.site?.siteCode?.toLowerCase().includes(q) || wo.site?.siteName?.toLowerCase().includes(q);
                    }
                    return true;
                  });
                  const visible = filtered.slice(0, mobileVisibleCount);
                  return (
                    <>
                      <MobileList loading={isLoading} count={filtered.length} empty="Không tìm thấy phiếu thi công">
                        {visible.map((wo: any) => (
                          <SwipeableWOCard
                            key={wo.id}
                            wo={wo}
                            role={user?.role ?? ''}
                            onOffice={() => openDrawer(wo, 'office')}
                            onTech={() => openDrawer(wo, 'tech')}
                            onLog={() => openDrawer(wo, 'log')}
                          />
                        ))}
                      </MobileList>
                      {filtered.length > visible.length && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                          <Button size="small" variant="outlined"
                            onClick={() => setMobileVisibleCount((c) => c + MOBILE_PAGE_SIZE)}>
                            Xem thêm ({filtered.length - visible.length} phiếu)
                          </Button>
                        </Box>
                      )}
                    </>
                  );
                })()}
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={drawerMode !== null}
        onClose={closeDrawer}
        slotProps={{ paper: { sx: isMobile ? { height: '92dvh', borderRadius: '16px 16px 0 0' } : { width: 380 } } }}
      >
        {activeWO && drawerMode === 'office' && (
          <OfficeDrawer wo={activeWO} onClose={closeDrawer} onSave={handleSave} readOnly={isPeriodClosed || isViewer} />
        )}
        {activeWO && drawerMode === 'tech' && (
          <TechDrawer wo={activeWO} onClose={closeDrawer} onSave={handleSave} readOnly={isPeriodClosed || isViewer} />
        )}
        {activeWO && drawerMode === 'log' && (
          <LogDrawer wo={activeWO} onClose={closeDrawer} />
        )}
      </Drawer>

      <Snackbar open={!!snack.msg} autoHideDuration={snack.sev === 'error' ? 5000 : 2000} onClose={() => setSnack({ msg: '' })}>
        <Alert severity={snack.sev ?? 'success'} variant="filled" onClose={() => setSnack({ msg: '' })}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
