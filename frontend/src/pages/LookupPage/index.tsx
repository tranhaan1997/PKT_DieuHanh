import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Box, TextField, Typography, InputAdornment, IconButton,
  Button, Drawer, Stack, Divider, Snackbar, Alert,
  FormControl, InputLabel, Select, MenuItem, useMediaQuery, useTheme,
} from '@mui/material';
import {
  SearchOutlined, ClearOutlined,
  Assignment, Construction, CalendarMonth, HistoryOutlined, Close, ArrowBackOutlined,
} from '@mui/icons-material';
import { useTopBar } from '../../components/layout/TopBarContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWorkOrders, updateWorkOrder, getWorkOrderLogs } from '../../api/workOrders';
import { getPeriod } from '../../api/periods';
import type { WorkOrderLog } from '../../api/workOrders';
import type { WorkOrder } from '../../types';
import MobileList from '../../components/ui/MobileList';
import LongPressCopy from '../../components/common/LongPressCopy';
import { useAuth } from '../../hooks/useAuth';
import { palette, status } from '../../theme/tokens';
import { FIELD_LABELS, formatLogValue } from '../../utils/workOrderLogFormat';

/* ── Status maps (same as WorkOrdersPage) ──────────────────────────────── */
const WRITTEN_OPTS  = [{ value: 'EMPTY', label: 'Trống' }, { value: 'WRITTEN', label: 'Đã viết' }];
const MATERIAL_OPTS = [{ value: 'EMPTY', label: 'Trống' }, { value: 'RECEIVED', label: 'Đã nhận' }, { value: 'TRANSFERRED', label: 'Đã chuyển' }];
const INSTALL_OPTS  = [{ value: 'NOT_STARTED', label: 'Chưa TH' }, { value: 'IN_PROGRESS', label: 'Đang TH' }, { value: 'COMPLETED', label: 'Hoàn thành' }, { value: 'CANCELLED', label: 'Hủy' }];
const PHOTO_OPTS    = [{ value: 'NOT_TAKEN', label: 'Chưa chụp' }, { value: 'TAKEN', label: 'Đã chụp' }];

type Tone = { color: string; bg: string; dot: string };
const T: Record<string, Tone> = {
  done:    { color: '#16A34A', bg: '#F0FDF4', dot: '#16A34A' },
  partial: { color: '#2563EB', bg: '#EFF6FF', dot: '#2563EB' },
  empty:   { color: '#94A3B8', bg: '#F8FAFC', dot: '#CBD5E1' },
  err:     { color: '#DC2626', bg: '#FEF2F2', dot: '#DC2626' },
};
const WRITTEN_INFO: Record<string, [string, Tone]>  = { EMPTY: ['Chưa viết', T.empty], WRITTEN: ['Đã viết', T.done] };
const MATERIAL_INFO: Record<string, [string, Tone]> = { EMPTY: ['Chưa nhận', T.empty], RECEIVED: ['Đã nhận', T.done], TRANSFERRED: ['Đã chuyển', T.partial] };
const INSTALL_INFO: Record<string, [string, Tone]>  = { NOT_STARTED: ['Chưa thực hiện', T.empty], IN_PROGRESS: ['Đang thực hiện', T.partial], COMPLETED: ['Hoàn thành', T.done], CANCELLED: ['Hủy', T.err] };
const PHOTO_INFO: Record<string, [string, Tone]>    = { NOT_TAKEN: ['Chưa chụp', T.empty], TAKEN: ['Đã chụp', T.done] };

type DrawerMode = 'office' | 'tech' | 'log' | null;

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
        <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>{(wo as any).ticketNo}</Typography>
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

/* ── Shared select field ────────────────────────────────────────────────── */
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

/* ── Drawer header ──────────────────────────────────────────────────────── */
function DrawerHeader({ wo, onClose }: { wo: WorkOrder; onClose: () => void }) {
  return (
    <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{(wo.site as any)?.siteCode}</Typography>
        <Typography variant="body2" color="text.secondary">{(wo.solution as any)?.solutionName}</Typography>
        <Typography variant="caption" color="text.secondary">{wo.ticketNo}</Typography>
      </Box>
      <IconButton size="small" onClick={onClose}><ClearOutlined fontSize="small" /></IconButton>
    </Box>
  );
}

/* ── Office drawer ──────────────────────────────────────────────────────── */
function OfficeDrawer({ wo, onClose, onSave, saving, forceReadOnly }: { wo: WorkOrder; onClose: () => void; onSave: (c: Partial<WorkOrder>) => void; saving?: boolean; forceReadOnly?: boolean }) {
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

/* ── Tech drawer ────────────────────────────────────────────────────────── */
function TechDrawer({ wo, onClose, onSave, saving, forceReadOnly }: { wo: WorkOrder; onClose: () => void; onSave: (c: Partial<WorkOrder>) => void; saving?: boolean; forceReadOnly?: boolean }) {
  const readOnly = forceReadOnly || (wo as any).period?.status === 'CLOSED';
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
        <Button onClick={onClose} disabled={saving}>Đóng</Button>
        {!readOnly && (
          <Button variant="contained" color="warning" startIcon={<Construction />} onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </Button>
        )}
      </Box>
    </Box>
  );
}


function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* ── Updater tag ────────────────────────────────────────────────────────── */
function UpdaterTag({ name, at }: { name?: string; at?: string }) {
  if (!name || !at) return null;
  return (
    <Typography sx={{ fontSize: '0.62rem', color: '#64748B', mt: 0.5 }}>
      <Box component="span" sx={{ fontWeight: 600 }}>{name}</Box>
      {' · '}{fmtDateTime(at)}
    </Typography>
  );
}

/* ── WO card content (shared between mobile swipe and desktop) ──────────── */
function WOCardContent({ wo, officeReady, open }: {
  wo: WorkOrder & { site?: any; solution?: any };
  officeReady: boolean; open?: boolean;
}) {
  const [wt, wtTone]       = WRITTEN_INFO[wo.writtenTicket]        ?? WRITTEN_INFO.EMPTY;
  const [ar, arTone]       = MATERIAL_INFO[wo.actReceivedMaterial]  ?? MATERIAL_INFO.EMPTY;
  const [tr, trTone]       = MATERIAL_INFO[wo.ttkvReceivedMaterial] ?? MATERIAL_INFO.EMPTY;
  const [sr, srTone]       = MATERIAL_INFO[wo.siteReceivedMaterial] ?? MATERIAL_INFO.EMPTY;
  const [inst, instTone]   = INSTALL_INFO[wo.installationStatus]    ?? INSTALL_INFO.NOT_STARTED;
  const [intg, intgTone]   = INSTALL_INFO[wo.integrationStatus]     ?? INSTALL_INFO.NOT_STARTED;
  const [photo, photoTone] = PHOTO_INFO[wo.photoStatus]             ?? PHOTO_INFO.NOT_TAKEN;

  return (
    <>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: palette.text.primary, lineHeight: 1.3 }}>
            {wo.solution?.solutionName}
          </Typography>
          <Typography sx={{ fontSize: '0.68rem', color: palette.text.muted, mt: 0.1 }}>
            {wo.ticketNo}
          </Typography>
        </Box>
        {open !== undefined && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, opacity: open ? 0 : 0.2, transition: 'opacity 0.2s', flexShrink: 0 }}>
            {[18, 13, 8].map((w) => <Box key={w} sx={{ width: w, height: 2, bgcolor: palette.text.muted, borderRadius: 1 }} />)}
          </Box>
        )}
      </Box>

      {/* Status rows */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{
          bgcolor: officeReady ? '#F0FDF4' : '#F8FAFC',
          border: `1px solid ${officeReady ? '#BBF7D0' : palette.border}`,
          borderRadius: 1.5, px: 1, pt: 0.625, pb: wo.officeUpdatedBy ? 0.75 : 0.625,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Assignment sx={{ fontSize: 13, color: officeReady ? '#16A34A' : '#94A3B8', flexShrink: 0 }} />
            <Box sx={{ display: 'flex', gap: 0.4, flexShrink: 0 }}>
              {[wtTone, arTone, trTone, srTone].map((t, i) => (
                <Box key={i} sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: t.dot }} />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {[{ label: 'Phiếu', value: wt, tone: wtTone }, { label: 'ACT', value: ar, tone: arTone }, { label: 'TTKV', value: tr, tone: trTone }, { label: 'Trạm', value: sr, tone: srTone }].map(({ label, value, tone }) => (
                <Typography key={label} sx={{ fontSize: '0.62rem', color: tone.color, fontWeight: 600, lineHeight: 1 }}>
                  {label}:<Box component="span" sx={{ fontWeight: 400, color: '#64748B', ml: 0.25 }}>{value}</Box>
                </Typography>
              ))}
            </Box>
          </Box>
          <UpdaterTag name={wo.officeUpdatedBy?.fullName} at={wo.officeUpdatedAt} />
        </Box>

        <Box sx={{
          bgcolor: '#FAFAFA', border: `1px solid ${palette.border}`,
          borderRadius: 1.5, px: 1, pt: 0.625, pb: wo.techUpdatedBy ? 0.75 : 0.625,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Construction sx={{ fontSize: 13, color: '#94A3B8', flexShrink: 0 }} />
            <Box sx={{ display: 'flex', gap: 0.4, flexShrink: 0 }}>
              {[instTone, intgTone, photoTone].map((t, i) => (
                <Box key={i} sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: t.dot }} />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {[{ label: 'Lắp', value: inst, tone: instTone }, { label: 'TH', value: intg, tone: intgTone }, { label: 'Ảnh', value: photo, tone: photoTone }].map(({ label, value, tone }) => (
                <Typography key={label} sx={{ fontSize: '0.62rem', color: tone.color, fontWeight: 600, lineHeight: 1 }}>
                  {label}:<Box component="span" sx={{ fontWeight: 400, color: '#64748B', ml: 0.25 }}>{value}</Box>
                </Typography>
              ))}
            </Box>
          </Box>
          <UpdaterTag name={wo.techUpdatedBy?.fullName} at={wo.techUpdatedAt} />
        </Box>
      </Box>

      {(wo.note || wo.issue) && (
        <Box sx={{ mt: 0.625, display: 'flex', flexDirection: 'column', gap: 0.3 }}>
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
    </>
  );
}

/* ── Swipeable WO card ──────────────────────────────────────────────────── */
function SwipeableWOCard({ wo, role, onOffice, onTech, onLog, isDesktop }: {
  wo: WorkOrder & { site?: any; solution?: any };
  role: string; onOffice: () => void; onTech: () => void; onLog: () => void;
  isDesktop: boolean;
}) {
  const isTech = role === 'TECHNICIAN';
  // Chỉ cho cập nhật thi công khi vật tư đã chuyển lên trạm
  const officeReady = wo.siteReceivedMaterial === 'TRANSFERRED';

  /* ── Desktop: card with inline action buttons ── */
  if (isDesktop) {
    return (
      <Box sx={{
        bgcolor: palette.card, border: `1px solid ${palette.border}`,
        borderRadius: 2.5, p: 1.5,
      }}>
        <WOCardContent wo={wo} officeReady={officeReady} />
        <Box sx={{ display: 'flex', gap: 1, mt: 1.25, pt: 1.25, borderTop: `1px solid ${palette.border}` }}>
          {!isTech && (
            <Button
              size="small"
              variant="contained"
              startIcon={<Assignment sx={{ fontSize: 15 }} />}
              onClick={onOffice}
              sx={{ fontSize: '0.72rem', py: 0.5, px: 1.25, bgcolor: palette.brand.main, '&:hover': { bgcolor: palette.brand.dark } }}
            >
              Cập nhật phiếu
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            startIcon={<Construction sx={{ fontSize: 15 }} />}
            onClick={onTech}
            disabled={!officeReady}
            color="warning"
            sx={{ fontSize: '0.72rem', py: 0.5, px: 1.25 }}
            title={!officeReady ? 'Chờ vật tư lên trạm' : undefined}
          >
            Cập nhật thi công
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<HistoryOutlined sx={{ fontSize: 15 }} />}
            onClick={onLog}
            sx={{ fontSize: '0.72rem', py: 0.5, px: 1.25, ml: 'auto', borderColor: palette.border, color: palette.text.secondary }}
          >
            Lịch sử
          </Button>
        </Box>
      </Box>
    );
  }

  /* ── Mobile: swipe to reveal ── */
  const ACTION_W = isTech ? 184 : 290;
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
        <WOCardContent wo={wo} officeReady={officeReady} open={open} />
      </Box>
    </Box>
  );
}

/* ── Period summary card ─────────────────────────────────────────────────── */
function PeriodCard({ periodCode, periodName, woCount, onClick }: {
  periodCode: string; periodName: string; woCount: number; onClick: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        bgcolor: palette.card, border: `1px solid ${palette.border}`, borderRadius: 2.5,
        p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5,
        cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:active': { bgcolor: `${palette.brand.main}08` },
        '&:hover': { borderColor: palette.brand.main, boxShadow: `0 0 0 2px ${palette.brand.main}18` },
      }}
    >
      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${palette.brand.main}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <CalendarMonth sx={{ fontSize: 22, color: palette.brand.main }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: palette.text.primary }}>{periodCode}</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: palette.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{periodName}</Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: palette.brand.main, lineHeight: 1 }}>{woCount}</Typography>
        <Typography sx={{ fontSize: '0.65rem', color: palette.text.muted }}>phiếu TC</Typography>
      </Box>
    </Box>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function LookupPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { setBack, clearBack } = useTopBar();

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selected period for drill-down
  const [selectedPeriod, setSelectedPeriod] = useState<{ id: number; periodCode: string; periodName: string } | null>(null);

  // Drawer state
  const [activeWO, setActiveWO]     = useState<WorkOrder | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [snack, setSnack]           = useState('');

  const openDrawer  = useCallback((wo: WorkOrder, mode: DrawerMode) => { setActiveWO(wo); setDrawerMode(mode); }, []);
  const closeDrawer = useCallback(() => { setActiveWO(null); setDrawerMode(null); }, []);

  const handleSearchChange = (val: string) => {
    setSearchText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val.trim()), 400);
  };

  const goBack = useCallback(() => {
    setSelectedPeriod(null);
    clearBack();
  }, [clearBack]);

  useEffect(() => {
    if (selectedPeriod) {
      setBack(selectedPeriod.periodName, goBack);
    } else {
      clearBack();
    }
    return () => clearBack();
  }, [selectedPeriod, goBack, setBack, clearBack]);

  const clearSearch = () => {
    setSearchText('');
    setDebouncedSearch('');
    setSelectedPeriod(null);
  };

  // Fetch WOs matching the search query
  const { data: allWOs, isLoading } = useQuery({
    queryKey: ['lookup-wos', debouncedSearch],
    queryFn: () => getWorkOrders({ search: debouncedSearch, limit: '500' }).then((r) => r.data.data),
    enabled: debouncedSearch.length >= 2,
  });

  // Group WOs by period — only exact siteCode match
  const periodGroups = useMemo(() => {
    if (!allWOs?.length) return [];
    const q = debouncedSearch.trim().toLowerCase();
    const matched = allWOs.filter((wo: any) => wo.site?.siteCode?.toLowerCase() === q);
    const map = new Map<number, { id: number; periodCode: string; periodName: string; wos: WorkOrder[] }>();
    matched.forEach((wo: any) => {
      if (!map.has(wo.periodId)) {
        map.set(wo.periodId, {
          id: wo.periodId,
          periodCode: wo.period?.periodCode ?? '',
          periodName: wo.period?.periodName ?? '',
          wos: [],
        });
      }
      map.get(wo.periodId)!.wos.push(wo);
    });
    return Array.from(map.values());
  }, [allWOs]);

  // Solution order for the selected period
  const { data: periodDetail } = useQuery({
    queryKey: ['period', selectedPeriod?.id],
    queryFn: () => getPeriod(selectedPeriod!.id).then((r) => r.data),
    enabled: !!selectedPeriod,
  });

  const solOrderMap = useMemo(() => {
    const map = new Map<number, number>();
    (periodDetail?.periodSolutions ?? []).forEach((ps: any, idx: number) => {
      map.set(ps.solutionId ?? ps.solution?.id, ps.order ?? idx);
    });
    return map;
  }, [periodDetail]);

  // WOs for the selected period — chỉ trạm đúng mã đã tìm, sort theo thứ tự giải pháp
  const periodWOs = useMemo(() => {
    if (!selectedPeriod || !allWOs) return [];
    const q = debouncedSearch.trim().toLowerCase();
    const filtered = allWOs.filter((wo: any) =>
      wo.periodId === selectedPeriod.id &&
      wo.site?.siteCode?.toLowerCase() === q
    );
    if (solOrderMap.size > 0) {
      filtered.sort((a: any, b: any) => {
        const oa = solOrderMap.get(a.solutionId) ?? 999;
        const ob = solOrderMap.get(b.solutionId) ?? 999;
        return oa - ob;
      });
    }
    return filtered;
  }, [allWOs, selectedPeriod, debouncedSearch, solOrderMap]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<WorkOrder> }) => updateWorkOrder(id, changes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lookup-wos'] });
      setSnack('Đã lưu');
      closeDrawer();
    },
    onError: () => setSnack('Lỗi khi lưu'),
  });

  const handleSave = useCallback((changes: Partial<WorkOrder>) => {
    if (!activeWO) return;
    updateMutation.mutate({ id: activeWO.id, changes });
  }, [activeWO, updateMutation]);

  /* ── Selected period view ── */
  if (selectedPeriod) {
    const siteInfo = periodWOs[0] as any;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 148px)' }}>
        {/* Header */}
        <Box sx={{ pb: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {isDesktop && (
              <IconButton size="small" onClick={goBack} sx={{ p: 0.5, ml: -0.5, color: palette.brand.main }}>
                <ArrowBackOutlined sx={{ fontSize: 18 }} />
              </IconButton>
            )}
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: palette.text.primary }}>
              <LongPressCopy value={siteInfo?.site?.siteCode}>{siteInfo?.site?.siteCode}</LongPressCopy>
            </Typography>
          </Box>
          {(siteInfo?.site?.address || siteInfo?.site?.district || siteInfo?.site?.province) && (
            <Typography sx={{ fontSize: '0.7rem', color: palette.text.secondary, mt: 0.5 }}>
              {[siteInfo?.site?.address, siteInfo?.site?.district, siteInfo?.site?.province].filter(Boolean).join(', ')}
            </Typography>
          )}
          {(siteInfo?.site?.managerName || siteInfo?.site?.phone) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
              {siteInfo?.site?.managerName && (
                <Typography sx={{ fontSize: '0.7rem', color: palette.text.secondary }}>
                  Quản lý: <Box component="span" sx={{ fontWeight: 700, color: palette.text.primary }}>{siteInfo.site.managerName}</Box>
                </Typography>
              )}
              {siteInfo?.site?.phone && (
                <Box
                  component="a"
                  href={`tel:${siteInfo.site.phone}`}
                  sx={{ fontSize: '0.7rem', color: palette.brand.main, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 0.4 }}
                >
                  📞 {siteInfo.site.phone}
                </Box>
              )}
            </Box>
          )}
          <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted, mt: 0.25 }}>{periodWOs.length} phiếu thi công</Typography>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <MobileList loading={false} count={periodWOs.length} empty="Không có phiếu thi công">
            {periodWOs.map((wo: any) => (
              <SwipeableWOCard
                key={wo.id}
                wo={wo}
                role={user?.role ?? ''}
                onOffice={() => openDrawer(wo, 'office')}
                onTech={() => openDrawer(wo, 'tech')}
                onLog={() => openDrawer(wo, 'log')}
                isDesktop={isDesktop}
              />
            ))}
          </MobileList>
        </Box>

        <Drawer
          anchor={isDesktop ? 'right' : 'bottom'}
          open={drawerMode !== null}
          onClose={closeDrawer}
          slotProps={{
            paper: {
              sx: isDesktop
                ? { width: 420, p: 0 }
                : { height: '92dvh', borderRadius: '16px 16px 0 0' },
            },
          }}
        >
          {activeWO && drawerMode === 'office' && <OfficeDrawer wo={activeWO} onClose={closeDrawer} onSave={handleSave} saving={updateMutation.isPending} forceReadOnly={user?.role === 'VIEWER'} />}
          {activeWO && drawerMode === 'tech'   && <TechDrawer   wo={activeWO} onClose={closeDrawer} onSave={handleSave} saving={updateMutation.isPending} forceReadOnly={user?.role === 'VIEWER'} />}
          {activeWO && drawerMode === 'log'    && <LogDrawer    wo={activeWO} onClose={closeDrawer} />}
        </Drawer>

        <Snackbar open={!!snack} autoHideDuration={2000} onClose={() => setSnack('')}>
          <Alert severity={snack === 'Lỗi khi lưu' ? 'error' : 'success'} variant="filled" onClose={() => setSnack('')}>{snack}</Alert>
        </Snackbar>
      </Box>
    );
  }

  /* ── Search view ── */
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: 'calc(100dvh - 148px)' }}>
      {/* Search box */}
      <TextField
        autoFocus
        size="small"
        fullWidth
        placeholder="Nhập mã trạm hoặc tên trạm..."
        value={searchText}
        onChange={(e) => handleSearchChange(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined sx={{ fontSize: 20, color: palette.brand.main }} />
              </InputAdornment>
            ),
            endAdornment: searchText ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={clearSearch}><ClearOutlined sx={{ fontSize: 16 }} /></IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
        sx={{
          '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: palette.card },
        }}
      />

      {/* Results */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {debouncedSearch.length < 2 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <SearchOutlined sx={{ fontSize: 48, color: palette.text.faint, mb: 1 }} />
            <Typography sx={{ fontSize: '0.875rem', color: palette.text.muted }}>Nhập mã hoặc tên trạm để tìm kiếm</Typography>
          </Box>
        )}

        {debouncedSearch.length >= 2 && isLoading && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ color: palette.text.muted, fontSize: '0.875rem' }}>Đang tìm kiếm...</Typography>
          </Box>
        )}

        {debouncedSearch.length >= 2 && !isLoading && periodGroups.length === 0 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ color: palette.text.muted, fontSize: '0.875rem' }}>Không tìm thấy kết quả cho "<strong>{debouncedSearch}</strong>"</Typography>
          </Box>
        )}

        {periodGroups.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', px: 0.25 }}>
              {periodGroups.length} kỳ thực hiện
            </Typography>
            {periodGroups.map((pg) => (
              <PeriodCard
                key={pg.id}
                periodCode={pg.periodCode}
                periodName={pg.periodName}
                woCount={pg.wos.length}
                onClick={() => setSelectedPeriod({ id: pg.id, periodCode: pg.periodCode, periodName: pg.periodName })}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
