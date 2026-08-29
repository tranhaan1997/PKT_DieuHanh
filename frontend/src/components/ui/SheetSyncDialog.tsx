import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, CircularProgress, Alert,
  Chip, Stack, Divider, useMediaQuery, useTheme,
} from '@mui/material';
import {
  CloudDownloadOutlined, CheckCircleOutlined, ErrorOutlined,
  RemoveCircleOutlined, TaskAltOutlined, WarningAmberOutlined, ContentCopyOutlined,
} from '@mui/icons-material';
import { previewWOsFromSheet, importWOsFromSheet } from '../../api/googleSheets';
import type { SheetPreview } from '../../api/googleSheets';
import { getApiErrorMessage } from '../../api/axios';
import { palette } from '../../theme/tokens';

interface Props {
  open: boolean;
  periodCode: string;
  onClose: () => void;
  onSuccess: (created: number) => void;
}

type Step = 'preview' | 'done';

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <Box sx={{
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: { xs: 0.25, sm: 0.5 }, py: { xs: 1, sm: 1.5 }, px: { xs: 0.5, sm: 1 }, borderRadius: 2,
      bgcolor: `${color}10`, border: `1px solid ${color}30`,
    }}>
      <Box sx={{ color, display: 'flex', alignItems: 'center', '& svg': { fontSize: { xs: 16, sm: 22 } } }}>{icon}</Box>
      <Typography sx={{ fontSize: { xs: '1.05rem', sm: '1.5rem' }, fontWeight: 800, color, lineHeight: 1 }}>{value}</Typography>
      <Typography sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' }, color: palette.text.secondary, textAlign: 'center', lineHeight: 1.25 }}>{label}</Typography>
    </Box>
  );
}

export default function SheetSyncDialog({ open, periodCode, onClose, onSuccess }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [step, setStep]       = useState<Step>('preview');
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError]     = useState('');
  const [result, setResult]   = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  const handleOpen = async () => {
    setStep('preview');
    setPreview(null);
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await previewWOsFromSheet(periodCode);
      setPreview(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Lỗi kết nối Google Sheets'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setImporting(true);
    try {
      const data = await importWOsFromSheet(periodCode);
      setResult(data);
      setStep('done');
      onSuccess(data.created);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Lỗi tạo phiếu'));
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => { if (open) handleOpen(); }, [open]);

  const newItems   = preview?.items.filter((i) => i.siteFound && i.solutionFound && !i.alreadyExists) ?? [];
  const errorItems = preview?.items.filter((i) => !i.siteFound || !i.solutionFound) ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      slotProps={{ paper: { sx: { maxHeight: '88vh', borderRadius: 3 } } }}>

      {/* ── Header ── */}
      <DialogTitle sx={{ pb: 1.5, px: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 } }}>
          <Box sx={{
            width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, borderRadius: 2, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: `${palette.brand.main}15`,
          }}>
            <CloudDownloadOutlined sx={{ color: palette.brand.main, fontSize: { xs: 18, sm: 22 } }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.875rem', sm: '1rem' }, lineHeight: 1.2 }}>Đồng bộ từ Google Sheets</Typography>
            <Typography sx={{ fontSize: { xs: '0.7rem', sm: '0.78rem' }, color: palette.text.secondary }}>Kỳ thực hiện: <strong>{periodCode}</strong></Typography>
          </Box>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 1.5, sm: 2.5 } }}>

        {/* Loading */}
        {(loading || importing) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
            <CircularProgress size={44} thickness={4} />
            <Typography sx={{ color: palette.text.secondary, fontSize: '0.9rem' }}>
              {loading ? 'Đang đọc dữ liệu từ Google Sheets...' : 'Đang tạo phiếu thi công...'}
            </Typography>
          </Box>
        )}

        {/* Error */}
        {!loading && !importing && error && (
          <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>
        )}

        {/* ── Preview ── */}
        {!loading && !importing && !error && step === 'preview' && preview && (
          <Stack spacing={{ xs: 1.5, sm: 2.5 }}>

            {/* Lỗi đọc cấu trúc Sheet */}
            {preview.errors.length > 0 && (
              <Alert severity="error" sx={{ borderRadius: 2, fontSize: { xs: '0.78rem', sm: '0.875rem' } }} icon={<ErrorOutlined />}>
                {preview.errors.map((e, i) => <div key={i}>{e}</div>)}
              </Alert>
            )}

            {/* Stat cards */}
            <Box sx={{ display: 'flex', gap: { xs: 0.75, sm: 1.5 } }}>
              <StatCard icon={<CheckCircleOutlined sx={{ fontSize: 22 }} />} value={preview.toCreate}
                label="Phiếu sẽ tạo mới" color="#16a34a" />
              <StatCard icon={<RemoveCircleOutlined sx={{ fontSize: 22 }} />} value={preview.alreadyExists}
                label="Đã tồn tại" color="#6b7280" />
              <StatCard icon={<ErrorOutlined sx={{ fontSize: 22 }} />} value={errorItems.length}
                label="Không tìm thấy" color={errorItems.length > 0 ? '#dc2626' : '#6b7280'} />
              <StatCard icon={<ContentCopyOutlined sx={{ fontSize: 22 }} />} value={preview.duplicateSites.length}
                label="Trạm trùng" color={preview.duplicateSites.length > 0 ? '#d97706' : '#6b7280'} />
            </Box>

            {/* Giải pháp trong kỳ */}
            {preview.periodSolutions.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: { xs: '0.66rem', sm: '0.72rem' }, fontWeight: 700, color: palette.text.muted, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>
                  Giải pháp đã gán vào kỳ ({preview.periodSolutions.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {preview.periodSolutions.map((sol) => (
                    <Chip key={sol.code} label={isMobile ? sol.code : `${sol.name} (${sol.code})`} size="small" color="primary" variant="outlined"
                      sx={{ fontWeight: 600, fontSize: { xs: '0.68rem', sm: '0.75rem' }, height: { xs: 22, sm: 24 } }} />
                  ))}
                </Box>
              </Box>
            )}

            {/* Cột bỏ qua */}
            {preview.notInPeriod.length > 0 && (
              <Alert severity="info" sx={{ borderRadius: 2, fontSize: { xs: '0.72rem', sm: '0.8rem' } }}>
                <strong>Cột trong Sheet chưa gán vào kỳ (bỏ qua):</strong>{' '}
                <Box sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: 0.5, ml: 0.5 }}>
                  {preview.notInPeriod.map((c) => <Chip key={c} label={c} size="small" sx={{ height: { xs: 20, sm: 24 }, fontSize: { xs: '0.65rem', sm: '0.75rem' } }} />)}
                </Box>
              </Alert>
            )}

            {/* Cảnh báo */}
            {preview.siteNotFound.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: { xs: '0.66rem', sm: '0.72rem' }, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <WarningAmberOutlined sx={{ fontSize: 14 }} /> Mã trạm không tìm thấy ({preview.siteNotFound.length})
                </Typography>
                <Box sx={{
                  display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 140, overflowY: 'auto',
                  p: 1, borderRadius: 2, bgcolor: '#FFF7ED', border: '1px solid #FED7AA',
                  '&::-webkit-scrollbar': { width: 5 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: '#FED7AA', borderRadius: 4 },
                }}>
                  {preview.siteNotFound.map((c) => (
                    <Chip key={c} label={c} size="small" color="warning" variant="outlined"
                      sx={{ fontWeight: 600, height: { xs: 20, sm: 24 }, fontSize: { xs: '0.65rem', sm: '0.75rem' } }} />
                  ))}
                </Box>
              </Box>
            )}
            {preview.solutionNotFound.length > 0 && (
              <Alert severity="warning" sx={{ borderRadius: 2, fontSize: { xs: '0.72rem', sm: '0.8rem' } }}>
                <strong>Mã giải pháp không tồn tại:</strong> {preview.solutionNotFound.join(', ')}
              </Alert>
            )}

            {/* Trạm bị trùng trong Sheet */}
            {preview.duplicateSites.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: { xs: '0.66rem', sm: '0.72rem' }, fontWeight: 700, color: palette.text.muted, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>
                  Mã trạm xuất hiện nhiều hơn 1 dòng trong Sheet ({preview.duplicateSites.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {preview.duplicateSites.map((c) => (
                    <Chip key={c} label={c} size="small" color="warning" variant="outlined"
                      sx={{ fontWeight: 600, height: { xs: 20, sm: 24 }, fontSize: { xs: '0.65rem', sm: '0.75rem' } }} />
                  ))}
                </Box>
              </Box>
            )}

            {/* Danh sách phiếu sẽ tạo */}
            {newItems.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: { xs: '0.66rem', sm: '0.72rem' }, fontWeight: 700, color: palette.text.muted, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 1 }}>
                  Danh sách phiếu sẽ được tạo ({newItems.length})
                </Typography>
                <Box sx={{
                  maxHeight: 280, overflowY: 'auto',
                  border: `1px solid ${palette.border}`, borderRadius: 2,
                  '&::-webkit-scrollbar': { width: 5 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: palette.border, borderRadius: 4 },
                }}>
                  {newItems.map((item, idx) => (
                    <Box key={idx} sx={{
                      display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, px: { xs: 1, sm: 2 }, py: { xs: 0.75, sm: 1 },
                      borderBottom: idx < newItems.length - 1 ? `1px solid ${palette.border}` : 'none',
                      '&:hover': { bgcolor: 'grey.50' },
                    }}>
                      <Typography sx={{ fontSize: { xs: '0.65rem', sm: '0.7rem' }, color: palette.text.muted, minWidth: { xs: 20, sm: 28 }, textAlign: 'right' }}>
                        {idx + 1}
                      </Typography>
                      <Typography sx={{ fontWeight: 600, fontSize: { xs: '0.78rem', sm: '0.85rem' }, flex: 1, minWidth: 0 }}>{item.siteCode}</Typography>
                      {item.solutionName && !isMobile && (
                        <Typography sx={{ fontSize: '0.78rem', color: palette.text.secondary }}>{item.solutionName}</Typography>
                      )}
                      <Chip label={item.solutionCode} size="small" color="primary" variant="outlined"
                        sx={{ fontWeight: 600, fontSize: { xs: '0.65rem', sm: '0.72rem' }, height: { xs: 20, sm: 24 } }} />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {preview.toCreate === 0 && preview.errors.length === 0 && (
              <Alert severity="info" sx={{ borderRadius: 2 }}>Không có phiếu mới nào cần tạo cho kỳ này.</Alert>
            )}
          </Stack>
        )}

        {/* ── Done ── */}
        {!loading && !importing && step === 'done' && result && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
            <Box sx={{
              width: 64, height: 64, borderRadius: '50%', bgcolor: '#16a34a15',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TaskAltOutlined sx={{ fontSize: 36, color: '#16a34a' }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>Hoàn tất!</Typography>
            <Typography sx={{ color: palette.text.secondary, textAlign: 'center' }}>
              Đã tạo <strong>{result.created}</strong> phiếu thi công mới
              {result.skipped > 0 && `, bỏ qua ${result.skipped} phiếu đã tồn tại`}.
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
        {step === 'preview' && !loading && !error && preview && preview.toCreate > 0 && (
          <Button variant="contained" onClick={handleConfirm} disabled={importing}
            startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <CloudDownloadOutlined />}
            sx={{ borderRadius: 2, fontWeight: 700 }}>
            Tạo {preview.toCreate} phiếu
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
