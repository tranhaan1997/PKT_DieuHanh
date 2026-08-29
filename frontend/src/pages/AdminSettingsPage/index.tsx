import { useState } from 'react';
import {
  Box, Button, TextField, Typography, Alert, Snackbar, Divider,
  CircularProgress, Chip, Stack, Accordion, AccordionSummary, AccordionDetails,
  List, ListItem, ListItemIcon, ListItemText, Link, Switch, FormControlLabel,
  Select, MenuItem, Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  CheckCircleOutlined, WarningAmberOutlined,
  ExpandMoreOutlined, LooksOneOutlined, LooksTwoOutlined, Looks3Outlined,
  Looks4Outlined, Looks5Outlined, ContentCopyOutlined, OpenInNewOutlined,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getGoogleSheetsConfig, saveGoogleSheetsConfig,
  getSheetWriteBackConfig, saveSheetWriteBackConfig,
  getAutoStatusSyncConfig, saveAutoStatusSyncConfig, getAutoStatusSyncRuns, runAutoStatusSyncNow,
  type AutoSyncRun,
} from '../../api/adminSettings';
import PageHeader from '../../components/ui/PageHeader';
import { palette } from '../../theme/tokens';

/* ── Reusable step component ─────────────────────────────────────── */
function Step({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <ListItem alignItems="flex-start" sx={{ px: 0, py: 0.75 }}>
      <ListItemIcon sx={{ minWidth: 36, mt: 0.25, color: palette.brand.main }}>
        {icon}
      </ListItemIcon>
      <ListItemText
        primary={children}
        slotProps={{ primary: { component: 'div', sx: { fontSize: '0.84rem', lineHeight: 1.7, color: '#374151' } } }}
      />
    </ListItem>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="code"
      sx={{
        display: 'inline-block', bgcolor: '#F1F5F9', border: '1px solid #E2E8F0',
        borderRadius: 0.75, px: 0.75, py: 0.1,
        fontFamily: 'monospace', fontSize: '0.8rem', color: '#1E40AF',
        wordBreak: 'break-all',
      }}
    >
      {children}
    </Box>
  );
}

/* ── Guide panel ─────────────────────────────────────────────────── */
function SetupGuide({ serviceAccountEmail }: { serviceAccountEmail?: string }) {
  const [copied, setCopied] = useState(false);

  const sheetHeader = 'Mã trạm\tGiải pháp\tKỳ thực hiện';

  const handleCopy = () => {
    navigator.clipboard.writeText(sheetHeader);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        border: `1px solid ${palette.border}`,
        borderRadius: '8px !important',
        '&:before': { display: 'none' },
        bgcolor: '#FAFBFE',
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ px: 2.5, minHeight: 48 }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: palette.brand.dark }}>
          Hướng dẫn thiết lập (lần đầu)
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
        <List dense disablePadding>

          {/* Step 1 */}
          <Step icon={<LooksOneOutlined />}>
            <strong>Tạo Google Cloud Project và bật Sheets API</strong>
            <Box sx={{ mt: 0.5 }}>
              Truy cập{' '}
              <Link href="https://console.cloud.google.com" target="_blank" rel="noopener" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                Google Cloud Console <OpenInNewOutlined sx={{ fontSize: 13 }} />
              </Link>
              {' '}→ tạo Project mới (hoặc chọn project đã có) →{' '}
              vào <strong>APIs &amp; Services → Library</strong> → tìm{' '}
              <strong>"Google Sheets API"</strong> → nhấn <strong>Enable</strong>.
            </Box>
          </Step>

          <Divider sx={{ my: 0.5, ml: 4.5 }} />

          {/* Step 2 */}
          <Step icon={<LooksTwoOutlined />}>
            <strong>Tạo Service Account và tải JSON Key</strong>
            <Box component="ol" sx={{ mt: 0.5, pl: 2.5, '& li': { mb: 0.5 } }}>
              <li>Vào <strong>APIs &amp; Services → Credentials → Create Credentials → Service account</strong></li>
              <li>Đặt tên (ví dụ: <Code>dh-sheets-reader</Code>), nhấn <strong>Done</strong></li>
              <li>Click vào service account vừa tạo → tab <strong>Keys → Add Key → Create new key → JSON</strong></li>
              <li>File <Code>.json</Code> sẽ tự tải về — đây là nội dung cần dán vào ô "Service Account JSON" bên dưới</li>
              <li>
                Lưu lại địa chỉ email của service account (dạng{' '}
                <Code>xxx@yyy.iam.gserviceaccount.com</Code>) — cần dùng ở bước tiếp theo
              </li>
            </Box>
          </Step>

          <Divider sx={{ my: 0.5, ml: 4.5 }} />

          {/* Step 3 */}
          <Step icon={<Looks3Outlined />}>
            <strong>Tạo Google Sheet và cấp quyền truy cập</strong>
            <Box component="ol" sx={{ mt: 0.5, pl: 2.5, '& li': { mb: 0.5 } }}>
              <li>
                Tạo Google Sheet mới → đặt tên tab (mặc định <Code>Sheet1</Code>)
              </li>
              <li>
                Hàng đầu tiên là <strong>header</strong> — cần có đúng 3 cột (có thể copy nhanh):
                <Box sx={{ mt: 0.75, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ bgcolor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 1, px: 1.5, py: 0.5, fontFamily: 'monospace', fontSize: '0.8rem', color: '#1D4ED8', flex: 1 }}>
                    Mã trạm &nbsp;|&nbsp; Giải pháp &nbsp;|&nbsp; Kỳ thực hiện
                  </Box>
                  <Button size="small" variant="outlined" startIcon={<ContentCopyOutlined sx={{ fontSize: 14 }} />}
                    onClick={handleCopy} sx={{ whiteSpace: 'nowrap', fontSize: '0.75rem', py: 0.25 }}>
                    {copied ? 'Đã copy!' : 'Copy header'}
                  </Button>
                </Box>
                Mỗi hàng tiếp theo = 1 phiếu thi công cần tạo
              </li>
              <li>
                Nhấn <strong>Share</strong> (góc trên phải) → dán email service account →{' '}
                chọn quyền <strong>Viewer</strong> → Send
                {serviceAccountEmail && (
                  <Box sx={{ mt: 0.5, p: 1, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 1 }}>
                    <Typography sx={{ fontSize: '0.78rem', color: '#166534' }}>
                      Email cần share: <Code>{serviceAccountEmail}</Code>
                    </Typography>
                  </Box>
                )}
              </li>
              <li>
                Lấy <strong>Spreadsheet ID</strong> từ URL:{' '}
                <Code>docs.google.com/spreadsheets/d/<strong style={{ color: '#DC2626' }}>{'<ID>'}</strong>/edit</Code>
              </li>
            </Box>
          </Step>

          <Divider sx={{ my: 0.5, ml: 4.5 }} />

          {/* Step 4 */}
          <Step icon={<Looks4Outlined />}>
            <strong>Điền thông tin vào form bên dưới và lưu</strong>
            <Box sx={{ mt: 0.5 }}>
              Dán <strong>Spreadsheet ID</strong>, nhập <strong>tên tab</strong>, dán toàn bộ nội dung file{' '}
              <Code>.json</Code> vào ô Service Account JSON → nhấn <strong>Lưu cấu hình</strong>.
            </Box>
          </Step>

          <Divider sx={{ my: 0.5, ml: 4.5 }} />

          {/* Step 5 */}
          <Step icon={<Looks5Outlined />}>
            <strong>Kiểm tra kết nối và sử dụng</strong>
            <Box sx={{ mt: 0.5 }}>
              Nhấn <strong>Kiểm tra kết nối</strong> — nếu hiện tên Google Sheet là thành công.
              Sau đó vào trang <strong>Kỳ thực hiện</strong> → nhấn{' '}
              <strong>"Tạo WO từ Google Sheets"</strong> để đồng bộ phiếu.
            </Box>
          </Step>

        </List>

        <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 1 }}>
          <Typography sx={{ fontSize: '0.8rem', color: '#92400E' }}>
            <strong>Lưu ý:</strong> Mã trạm, Giải pháp và Kỳ thực hiện phải khớp chính xác với dữ liệu
            đã có trong hệ thống. Phiếu đã tồn tại sẽ tự động bỏ qua, không tạo trùng.
          </Typography>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

const SYNC_FIELD_LABELS: Record<string, string> = {
  writtenTicket: 'Viết phiếu', actReceivedMaterial: 'ACT nhận VT',
  ttkvReceivedMaterial: 'TTKV nhận VT', siteReceivedMaterial: 'VT lên trạm',
};
const SYNC_STATUS_LABELS: Record<string, string> = {
  EMPTY: 'Trống', WRITTEN: 'Đã viết', RECEIVED: 'Đã nhận', TRANSFERRED: 'Đã chuyển',
};

/* ── Main page ───────────────────────────────────────────────────── */
export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const [snack, setSnack]         = useState('');
  const [saJson, setSaJson]       = useState('');
  const [configExpandedOverride, setConfigExpandedOverride] = useState<boolean | null>(null);
  const [jsonError, setJsonError] = useState('');
  const [viewRun, setViewRun]     = useState<AutoSyncRun | null>(null);

  let serviceAccountEmail: string | undefined;
  try {
    if (saJson.trim()) serviceAccountEmail = JSON.parse(saJson).client_email;
  } catch { /* ignore */ }

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-settings-gsheets'],
    queryFn: getGoogleSheetsConfig,
  });
  const configExpanded = configExpandedOverride ?? !config?.hasServiceAccount;

  const { data: writeBackConfig, isLoading: isLoadingWriteBack } = useQuery({
    queryKey: ['admin-settings-sheet-write-back'],
    queryFn: getSheetWriteBackConfig,
  });

  const writeBackMutation = useMutation({
    mutationFn: saveSheetWriteBackConfig,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-settings-sheet-write-back'] });
      setSnack(res.enabled ? 'Đã bật đồng bộ ngược lên Google Sheet' : 'Đã tắt đồng bộ ngược lên Google Sheet');
    },
    onError: (e: any) => setSnack('Lỗi: ' + (e?.response?.data?.message || e?.message)),
  });

  const { data: autoSyncConfig, isLoading: isLoadingAutoSync } = useQuery({
    queryKey: ['admin-settings-auto-status-sync'],
    queryFn: getAutoStatusSyncConfig,
  });

  const { data: autoSyncRuns } = useQuery({
    queryKey: ['admin-settings-auto-status-sync-runs'],
    queryFn: getAutoStatusSyncRuns,
    refetchInterval: 30_000,
  });

  const autoSyncMutation = useMutation({
    mutationFn: saveAutoStatusSyncConfig,
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-settings-auto-status-sync'] });
      setSnack(vars.enabled ? 'Đã bật đồng bộ tự động' : 'Đã tắt đồng bộ tự động');
    },
    onError: (e: any) => setSnack('Lỗi: ' + (e?.response?.data?.message || e?.message)),
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

  const saveMutation = useMutation({
    mutationFn: saveGoogleSheetsConfig,
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['admin-settings-gsheets'] });
        setSaJson('');
        setConfigExpandedOverride(null);
        setSnack('Đã lưu cấu hình');
      } else {
        setSnack('Lỗi: ' + (res.error || 'Không thể lưu'));
      }
    },
    onError: (e: any) => setSnack('Lỗi: ' + (e?.response?.data?.message || e?.message)),
  });

  const handleSave = () => {
    if (!saJson.trim()) { setJsonError('Vui lòng dán Service Account JSON'); return; }
    try { JSON.parse(saJson); setJsonError(''); }
    catch { setJsonError('JSON không hợp lệ — kiểm tra lại nội dung'); return; }
    saveMutation.mutate({ googleServiceAccountJson: saJson });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 760, px: { xs: 2, md: 0 } }}>
      <PageHeader title="Cài đặt hệ thống" subtitle="Cấu hình tích hợp và dịch vụ bên ngoài" />

      {/* Guide */}
      <SetupGuide serviceAccountEmail={serviceAccountEmail} />

      {/* Sync toggle */}
      <Box sx={{ bgcolor: 'white', borderRadius: 2, border: `1px solid ${palette.border}`, p: 3 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
              Đồng bộ ngược tiến độ thi công lên Google Sheet
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
              Khi cập nhật phiếu thi công, hệ thống sẽ tự ghi tiến độ ngược lên Google Sheet (nếu kỳ đã cấu hình).
              Tắt khi cần bảo trì hoặc debug mà không muốn ghi đè dữ liệu trên Sheet.
            </Typography>
          </Box>
          {isLoadingWriteBack ? (
            <CircularProgress size={20} />
          ) : (
            <FormControlLabel
              labelPlacement="start"
              label={writeBackConfig?.enabled ? 'Đang bật' : 'Đang tắt'}
              sx={{ ml: 2, flexShrink: 0 }}
              control={
                <Switch
                  checked={writeBackConfig?.enabled ?? true}
                  disabled={writeBackMutation.isPending}
                  onChange={(e) => writeBackMutation.mutate(e.target.checked)}
                />
              }
            />
          )}
        </Stack>
      </Box>

      {/* Auto status sync */}
      <Box sx={{ bgcolor: 'white', borderRadius: 2, border: `1px solid ${palette.border}`, p: 3 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
              Tự động đồng bộ trạng thái viết phiếu từ Google Sheet
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
              Tự động đọc đủ 4 trạng thái: Viết phiếu / ACT nhận VT / TTKV nhận VT / VT lên trạm
              từ Sheet về hệ thống theo chu kỳ, cho mọi kỳ đang hoạt động đã cấu hình đủ 4 cột tương ứng trên Sheet.
              Thay đổi do hệ thống tự ghi sẽ không gán cho người dùng cụ thể.
            </Typography>
          </Box>
          {isLoadingAutoSync ? (
            <CircularProgress size={20} />
          ) : (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
              <Select
                size="small"
                value={autoSyncConfig?.intervalMinutes ?? 15}
                disabled={!autoSyncConfig?.enabled || autoSyncMutation.isPending}
                onChange={(e) => autoSyncMutation.mutate({ enabled: true, intervalMinutes: Number(e.target.value) })}
                sx={{ minWidth: 110 }}
              >
                <MenuItem value={5}>Mỗi 5 phút</MenuItem>
                <MenuItem value={15}>Mỗi 15 phút</MenuItem>
                <MenuItem value={30}>Mỗi 30 phút</MenuItem>
                <MenuItem value={60}>Mỗi 60 phút</MenuItem>
              </Select>
              <FormControlLabel
                labelPlacement="start"
                label={autoSyncConfig?.enabled ? 'Đang bật' : 'Đang tắt'}
                control={
                  <Switch
                    checked={autoSyncConfig?.enabled ?? false}
                    disabled={autoSyncMutation.isPending}
                    onChange={(e) => autoSyncMutation.mutate({
                      enabled: e.target.checked,
                      intervalMinutes: autoSyncConfig?.intervalMinutes ?? 15,
                    })}
                  />
                }
              />
              <Button
                size="small" variant="outlined"
                disabled={runNowMutation.isPending}
                startIcon={runNowMutation.isPending ? <CircularProgress size={14} /> : undefined}
                onClick={() => runNowMutation.mutate()}
              >
                {runNowMutation.isPending ? 'Đang chạy...' : 'Test ngay'}
              </Button>
            </Stack>
          )}
        </Stack>

        {!!autoSyncRuns?.length && (
          <Box sx={{ mt: 2.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Lịch sử chạy gần nhất <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>(tối đa 20 lượt)</Box>
            </Typography>
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
                      <Chip
                        size="small"
                        label={run.status === 'SUCCESS' ? 'Thành công' : run.status === 'PARTIAL' ? 'Có lỗi' : 'Thất bại'}
                        color={run.status === 'SUCCESS' ? 'success' : run.status === 'PARTIAL' ? 'warning' : 'error'}
                      />
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
          </Box>
        )}
      </Box>

      {/* Modal chi tiết phiếu đã cập nhật */}
      <Dialog open={!!viewRun} onClose={() => setViewRun(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          Chi tiết lượt đồng bộ — {viewRun && new Date(viewRun.startedAt).toLocaleString('vi-VN')}
        </DialogTitle>
        <DialogContent>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewRun(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      {/* Config form */}
      <Accordion
        expanded={configExpanded}
        onChange={(_, exp) => setConfigExpandedOverride(exp)}
        sx={{ bgcolor: 'white', borderRadius: 2, border: `1px solid ${palette.border}`, '&::before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Google Sheets — Cấu hình kết nối</Typography>
            {isLoading ? (
              <CircularProgress size={16} />
            ) : config?.hasServiceAccount ? (
              <Chip icon={<CheckCircleOutlined />} label="Service Account đã cấu hình" color="success" size="small" />
            ) : (
              <Chip icon={<WarningAmberOutlined />} label="Chưa cấu hình" color="warning" size="small" />
            )}
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
              Service Account JSON{' '}
              {config?.hasServiceAccount && (
                <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                  (đã có — để trống nếu không muốn thay đổi)
                </Box>
              )}
            </Typography>
            <TextField
              multiline
              rows={9}
              value={saJson}
              onChange={(e) => { setSaJson(e.target.value); setJsonError(''); }}
              fullWidth
              size="small"
              placeholder={'{\n  "type": "service_account",\n  "project_id": "my-project",\n  "private_key_id": "...",\n  "private_key": "-----BEGIN RSA PRIVATE KEY-----\\n...",\n  "client_email": "dh-sheets@my-project.iam.gserviceaccount.com",\n  ...\n}'}
              error={!!jsonError}
              helperText={jsonError || 'Dán toàn bộ nội dung file .json tải về từ Google Cloud Console (bước 2 trong hướng dẫn)'}
              sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.78rem' } }}
            />
            {serviceAccountEmail && (
              <Box sx={{ mt: 1, p: 1.25, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '0.78rem', color: '#166534' }}>
                  Email service account: <strong>{serviceAccountEmail}</strong>
                  {' '}— nhớ Share Google Sheet với địa chỉ này (quyền Viewer)
                </Typography>
              </Box>
            )}
          </Box>

          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              disabled={saveMutation.isPending}
              onClick={handleSave}
            >
              {saveMutation.isPending ? 'Đang lưu...' : 'Lưu cấu hình'}
            </Button>
          </Stack>
        </Stack>
        </AccordionDetails>
      </Accordion>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity={snack.startsWith('Lỗi') ? 'error' : 'success'} onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </Box>
  );
}
