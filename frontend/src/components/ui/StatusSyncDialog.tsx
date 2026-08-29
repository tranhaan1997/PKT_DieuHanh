import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, CircularProgress, Alert,
  Stack, Divider, Chip,
} from '@mui/material';
import {
  SyncOutlined, CheckCircleOutlined, ErrorOutlined,
  RemoveCircleOutlined, TaskAltOutlined, WarningAmberOutlined, ContentCopyOutlined,
} from '@mui/icons-material';
import { previewStatusSync, syncStatusesFromSheet } from '../../api/googleSheets';
import type { StatusSyncPreview } from '../../api/googleSheets';
import { getApiErrorMessage } from '../../api/axios';
import { palette } from '../../theme/tokens';

interface Props {
  open: boolean;
  periodCode: string;
  solutionId: number;
  solutionName: string;
  onClose: () => void;
  onSuccess: (updated: number) => void;
}

type Step = 'preview' | 'done';

const WRITTEN_LABEL: Record<string, string> = { EMPTY: 'Trống', WRITTEN: 'Đã viết' };
const MATERIAL_LABEL: Record<string, string> = { EMPTY: 'Trống', RECEIVED: 'Đã nhận', TRANSFERRED: 'Đã chuyển' };

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <Box sx={{
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 0.5, py: 1.5, px: 1, borderRadius: 2,
      bgcolor: `${color}10`, border: `1px solid ${color}30`,
    }}>
      <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{icon}</Box>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</Typography>
      <Typography sx={{ fontSize: '0.7rem', color: palette.text.secondary, textAlign: 'center', lineHeight: 1.3 }}>{label}</Typography>
    </Box>
  );
}

export default function StatusSyncDialog({ open, periodCode, solutionId, solutionName, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('preview');
  const [preview, setPreview] = useState<StatusSyncPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ updated: number; errors: string[] } | null>(null);

  const handleOpen = async () => {
    setStep('preview');
    setPreview(null);
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await previewStatusSync(periodCode, solutionId);
      setPreview(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Lỗi kết nối Google Sheets'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setSyncing(true);
    try {
      const data = await syncStatusesFromSheet(periodCode, solutionId);
      setResult(data);
      setStep('done');
      onSuccess(data.updated);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Lỗi đồng bộ trạng thái'));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { if (open) handleOpen(); }, [open]);

  const changedItems = preview?.items.filter((i) => i.changed) ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      slotProps={{ paper: { sx: { maxHeight: '88vh', borderRadius: 3 } } }}>

      <DialogTitle sx={{ pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: `${palette.brand.main}15`,
          }}>
            <SyncOutlined sx={{ color: palette.brand.main, fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>Đồng bộ trạng thái từ Google Sheet</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: palette.text.secondary }}>
              {solutionName} · Kỳ: <strong>{periodCode}</strong>
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ px: 3, py: 2.5 }}>

        {(loading || syncing) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
            <CircularProgress size={44} thickness={4} />
            <Typography sx={{ color: palette.text.secondary, fontSize: '0.9rem' }}>
              {loading ? 'Đang đọc dữ liệu từ Google Sheets...' : 'Đang cập nhật trạng thái...'}
            </Typography>
          </Box>
        )}

        {!loading && !syncing && error && (
          <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>
        )}

        {!loading && !syncing && !error && step === 'preview' && preview && (
          <Stack spacing={2.5}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <StatCard icon={<CheckCircleOutlined sx={{ fontSize: 22 }} />} value={preview.toUpdate}
                label="Sẽ cập nhật" color="#16a34a" />
              <StatCard icon={<RemoveCircleOutlined sx={{ fontSize: 22 }} />} value={preview.unchanged}
                label="Không thay đổi" color="#6b7280" />
              <StatCard icon={<ErrorOutlined sx={{ fontSize: 22 }} />} value={preview.siteNotFound.length}
                label="Không tìm thấy" color={preview.siteNotFound.length > 0 ? '#dc2626' : '#6b7280'} />
              <StatCard icon={<ContentCopyOutlined sx={{ fontSize: 22 }} />} value={preview.duplicateSites.length}
                label="Trạm trùng" color={preview.duplicateSites.length > 0 ? '#d97706' : '#6b7280'} />
            </Box>

            {preview.siteNotFound.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <WarningAmberOutlined sx={{ fontSize: 14 }} /> Mã trạm không tìm thấy / chưa có phiếu thi công ({preview.siteNotFound.length})
                </Typography>
                <Box sx={{
                  display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 140, overflowY: 'auto',
                  p: 1, borderRadius: 2, bgcolor: '#FFF7ED', border: '1px solid #FED7AA',
                  '&::-webkit-scrollbar': { width: 5 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: '#FED7AA', borderRadius: 4 },
                }}>
                  {preview.siteNotFound.map((c) => (
                    <Chip key={c} label={c} size="small" color="warning" variant="outlined" sx={{ fontWeight: 600 }} />
                  ))}
                </Box>
              </Box>
            )}

            {preview.duplicateSites.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: palette.text.muted, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>
                  Mã trạm xuất hiện nhiều hơn 1 dòng trong Sheet ({preview.duplicateSites.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {preview.duplicateSites.map((c) => (
                    <Chip key={c} label={c} size="small" color="warning" variant="outlined" sx={{ fontWeight: 600 }} />
                  ))}
                </Box>
              </Box>
            )}

            {changedItems.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: palette.text.muted, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>
                  Phiếu sẽ được cập nhật ({changedItems.length})
                </Typography>
                <Box sx={{
                  maxHeight: 320, overflowY: 'auto',
                  border: `1px solid ${palette.border}`, borderRadius: 2,
                  '&::-webkit-scrollbar': { width: 5 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: palette.border, borderRadius: 4 },
                }}>
                  {changedItems.map((item, idx) => (
                    <Box key={idx} sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1,
                      borderBottom: idx < changedItems.length - 1 ? `1px solid ${palette.border}` : 'none',
                      '&:hover': { bgcolor: 'grey.50' },
                    }}>
                      <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted, minWidth: 28, textAlign: 'right' }}>
                        {idx + 1}
                      </Typography>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', minWidth: 90 }}>{item.siteCode}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: palette.text.secondary, flex: 1 }}>
                        Viết phiếu: {WRITTEN_LABEL[item.current.writtenTicket]} → <strong>{WRITTEN_LABEL[item.sheet.writtenTicket]}</strong>
                        {' · '}ACT nhận VT: {MATERIAL_LABEL[item.current.actReceivedMaterial]} → <strong>{MATERIAL_LABEL[item.sheet.actReceivedMaterial]}</strong>
                        {' · '}TTKV nhận VT: {MATERIAL_LABEL[item.current.ttkvReceivedMaterial]} → <strong>{MATERIAL_LABEL[item.sheet.ttkvReceivedMaterial]}</strong>
                        {' · '}Chuyển VT lên trạm: {MATERIAL_LABEL[item.current.siteReceivedMaterial]} → <strong>{MATERIAL_LABEL[item.sheet.siteReceivedMaterial]}</strong>
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {preview.toUpdate === 0 && (
              <Alert severity="info" sx={{ borderRadius: 2 }}>Không có trạng thái nào cần cập nhật.</Alert>
            )}
          </Stack>
        )}

        {!loading && !syncing && step === 'done' && result && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
            <Box sx={{
              width: 64, height: 64, borderRadius: '50%', bgcolor: '#16a34a15',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TaskAltOutlined sx={{ fontSize: 36, color: '#16a34a' }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>Hoàn tất!</Typography>
            <Typography sx={{ color: palette.text.secondary, textAlign: 'center' }}>
              Đã cập nhật trạng thái cho <strong>{result.updated}</strong> phiếu thi công.
            </Typography>
            {result.errors.length > 0 && (
              <Alert severity="warning" sx={{ borderRadius: 2, width: '100%' }} icon={<WarningAmberOutlined />}>
                {result.errors.map((e, i) => <div key={i}>{e}</div>)}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: palette.text.secondary }}>
          {step === 'done' ? 'Đóng' : 'Hủy'}
        </Button>
        {step === 'preview' && !loading && !error && preview && preview.toUpdate > 0 && (
          <Button variant="contained" onClick={handleConfirm} disabled={syncing}
            startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncOutlined />}
            sx={{ borderRadius: 2, fontWeight: 700 }}>
            Cập nhật {preview.toUpdate} phiếu
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
