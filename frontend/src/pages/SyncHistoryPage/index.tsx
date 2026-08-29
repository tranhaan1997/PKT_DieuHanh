import { useState } from 'react';
import {
  Box, Typography, Chip, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Snackbar, Alert, useMediaQuery, useTheme,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAutoStatusSyncRuns, runAutoStatusSyncNow, type AutoSyncRun } from '../../api/adminSettings';
import PageHeader from '../../components/ui/PageHeader';
import { palette } from '../../theme/tokens';

const SYNC_FIELD_LABELS: Record<string, string> = {
  writtenTicket: 'Viết phiếu', actReceivedMaterial: 'ACT nhận VT',
  ttkvReceivedMaterial: 'TTKV nhận VT', siteReceivedMaterial: 'VT lên trạm',
};
const SYNC_STATUS_LABELS: Record<string, string> = {
  EMPTY: 'Trống', WRITTEN: 'Đã viết', RECEIVED: 'Đã nhận', TRANSFERRED: 'Đã chuyển',
};

function statusLabel(status: AutoSyncRun['status']) {
  return status === 'SUCCESS' ? 'Thành công' : status === 'PARTIAL' ? 'Có lỗi' : 'Thất bại';
}
function statusColor(status: AutoSyncRun['status']) {
  return status === 'SUCCESS' ? 'success' : status === 'PARTIAL' ? 'warning' : 'error';
}

export default function SyncHistoryPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const qc = useQueryClient();
  const [viewRun, setViewRun] = useState<AutoSyncRun | null>(null);
  const [snack, setSnack] = useState('');

  const { data: autoSyncRuns } = useQuery({
    queryKey: ['admin-settings-auto-status-sync-runs'],
    queryFn: getAutoStatusSyncRuns,
    refetchInterval: 30_000,
  });

  const runNowMutation = useMutation({
    mutationFn: runAutoStatusSyncNow,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-settings-auto-status-sync-runs'] });
      if (!res.success) { setSnack('Lỗi: ' + res.message); return; }
      const run = res.run!;
      if (run.periodsProcessed === 0) {
        setSnack('Chạy thử xong: không tìm thấy kỳ/giải pháp nào đủ cấu hình 4 cột trạng thái Sheet để quét');
      } else {
        setSnack(`Chạy thử xong: quét ${run.periodsProcessed} kỳ/GP, cập nhật ${run.totalUpdated} phiếu${run.errors?.length ? `, lỗi: ${run.errors.join('; ')}` : ''}`);
      }
    },
    onError: (e: any) => setSnack('Lỗi: ' + (e?.response?.data?.message || e?.message)),
  });

  const runNowButton = (
    <Button
      variant="outlined"
      disabled={runNowMutation.isPending}
      startIcon={runNowMutation.isPending ? <CircularProgress size={14} /> : undefined}
      onClick={() => runNowMutation.mutate()}
      sx={{ flexShrink: 0 }}
    >
      {runNowMutation.isPending ? 'Đang chạy...' : 'Test đồng bộ ngay'}
    </Button>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 1000, px: { xs: 0, md: 0 } }}>
      {isMobile ? (
        <Box>{runNowButton}</Box>
      ) : (
        <PageHeader title="Lịch sử đồng bộ tự động" subtitle="Các lượt tự động đọc trạng thái viết phiếu / nhận vật tư từ Google Sheet" actions={runNowButton} />
      )}

      <Box sx={{ bgcolor: 'white', borderRadius: 2, border: `1px solid ${palette.border}`, p: { xs: 1.5, md: 3 } }}>
        {!autoSyncRuns?.length ? (
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>Chưa có lượt đồng bộ nào.</Typography>
        ) : isMobile ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {autoSyncRuns.map((run) => (
              <Box key={run.id} sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${palette.border}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    {new Date(run.startedAt).toLocaleString('vi-VN')}
                  </Typography>
                  <Chip size="small" label={statusLabel(run.status)} color={statusColor(run.status)} />
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                    Kỳ/GP quét: <strong style={{ color: palette.text.primary }}>{run.periodsProcessed}</strong>
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                    Phiếu cập nhật: <strong style={{ color: palette.text.primary }}>{run.totalUpdated}</strong>
                  </Typography>
                </Box>
                {!!run.errors?.length && (
                  <Typography sx={{ fontSize: '0.72rem', color: 'error.main', mt: 0.75 }}>{run.errors.join('; ')}</Typography>
                )}
                {!!run.updatedItems?.length && (
                  <Button size="small" sx={{ mt: 0.5, px: 0 }} onClick={() => setViewRun(run)}>Xem chi tiết</Button>
                )}
              </Box>
            ))}
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Thời gian</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Số kỳ/GP quét</TableCell>
                <TableCell align="right">Số phiếu cập nhật</TableCell>
                <TableCell>Lỗi</TableCell>
                <TableCell align="right">Chi tiết</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {autoSyncRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(run.startedAt).toLocaleString('vi-VN')}</TableCell>
                  <TableCell>
                    <Chip size="small" label={statusLabel(run.status)} color={statusColor(run.status)} />
                  </TableCell>
                  <TableCell align="right">{run.periodsProcessed}</TableCell>
                  <TableCell align="right">{run.totalUpdated}</TableCell>
                  <TableCell sx={{ maxWidth: 280, fontSize: '0.75rem', color: 'text.secondary' }}>
                    {run.errors?.join('; ') || ''}
                  </TableCell>
                  <TableCell align="right">
                    {!!run.updatedItems?.length && (
                      <Button size="small" onClick={() => setViewRun(run)}>Xem</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      <Dialog open={!!viewRun} onClose={() => setViewRun(null)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>
          Chi tiết lượt đồng bộ — {viewRun && new Date(viewRun.startedAt).toLocaleString('vi-VN')}
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 1.5, sm: 3 } }}>
          {isMobile ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {viewRun?.updatedItems?.map((item, i) => (
                <Box key={i} sx={{ p: 1.25, borderRadius: 2, border: `1px solid ${palette.border}` }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700 }}>{item.ticketNo}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{item.siteCode} — {item.siteName}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>{item.periodCode} / {item.solutionCode}</Typography>
                  {Object.entries(item.changes).map(([field, c]) => (
                    <Typography key={field} sx={{ fontSize: '0.75rem' }}>
                      <strong>{SYNC_FIELD_LABELS[field] ?? field}</strong>: {SYNC_STATUS_LABELS[c.from] ?? c.from} → {SYNC_STATUS_LABELS[c.to] ?? c.to}
                    </Typography>
                  ))}
                </Box>
              ))}
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ticket No</TableCell>
                  <TableCell>Trạm</TableCell>
                  <TableCell>Kỳ / Giải pháp</TableCell>
                  <TableCell>Thay đổi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {viewRun?.updatedItems?.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.ticketNo}</TableCell>
                    <TableCell>{item.siteCode} — {item.siteName}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.periodCode} / {item.solutionCode}</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem' }}>
                      {Object.entries(item.changes).map(([field, c]) => (
                        <Box key={field}>
                          <strong>{SYNC_FIELD_LABELS[field] ?? field}</strong>:{' '}
                          {SYNC_STATUS_LABELS[c.from] ?? c.from} → {SYNC_STATUS_LABELS[c.to] ?? c.to}
                        </Box>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewRun(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={5000} onClose={() => setSnack('')}>
        <Alert severity={snack.startsWith('Lỗi') ? 'error' : 'success'} onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  );
}
