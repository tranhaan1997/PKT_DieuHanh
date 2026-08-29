import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, TextField, InputAdornment, IconButton, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import { SearchOutlined, ClearOutlined } from '@mui/icons-material';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import MobileList from '../../components/ui/MobileList';
import { useTopBar } from '../../components/layout/TopBarContext';
import { getMyWorkOrderLogs } from '../../api/workOrders';
import type { MyWorkOrderLog } from '../../api/workOrders';
import { FIELD_LABELS, formatLogValue } from '../../utils/workOrderLogFormat';
import { palette } from '../../theme/tokens';

const PAGE_SIZE = 20;

function LogItem({ log, compact }: { log: MyWorkOrderLog; compact?: boolean }) {
  const wo = log.workOrder;

  if (compact) {
    const fields = Object.entries(log.changes);
    return (
      <Box sx={{
        border: `1px solid ${palette.border}`, borderRadius: 2, p: 1.1,
        bgcolor: palette.card,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 0.75 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: palette.text.primary, lineHeight: 1.2 }}>
            {wo.ticketNo}
          </Typography>
          <Typography sx={{ fontSize: '0.64rem', color: palette.text.muted, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {new Date(log.createdAt).toLocaleDateString('vi-VN')} {new Date(log.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: palette.text.secondary, lineHeight: 1.3, mt: 0.125 }}>
          {wo.site?.siteCode} · {wo.solution?.solutionName}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.625 }}>
          {fields.map(([field, { to }]) => (
            <Box key={field} sx={{
              display: 'flex', alignItems: 'center', gap: 0.3,
              bgcolor: palette.cardAlt, border: `1px solid ${palette.border}`,
              borderRadius: 1, px: 0.75, py: 0.25,
            }}>
              <Typography sx={{ fontSize: '0.62rem', color: palette.text.muted }}>{FIELD_LABELS[field] ?? field}</Typography>
              <Typography sx={{ fontSize: '0.62rem', color: '#16A34A', fontWeight: 600 }}>{formatLogValue(field, to)}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      border: `1px solid ${palette.border}`, borderRadius: 2.5, p: 1.75,
      bgcolor: palette.card,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: palette.text.primary }}>
            {wo.ticketNo}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: palette.text.secondary, mt: 0.125 }}>
            {wo.site?.siteCode} — {wo.site?.siteName}
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: palette.text.muted, mt: 0.125 }}>
            {wo.solution?.solutionName} · {wo.period?.periodName}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: palette.text.muted, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {new Date(log.createdAt).toLocaleString('vi-VN')}
        </Typography>
      </Box>
      <Box sx={{ bgcolor: palette.cardAlt, borderRadius: 1.5, p: 1, mt: 1, border: `1px solid ${palette.border}` }}>
        {Object.entries(log.changes).map(([field, { from, to }]) => (
          <Box key={field} sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5, '&:last-child': { mb: 0 } }}>
            <Typography sx={{ fontSize: '0.7rem', color: palette.text.secondary, minWidth: 100 }}>{FIELD_LABELS[field] ?? field}:</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#DC2626', textDecoration: 'line-through' }}>{formatLogValue(field, from)}</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: palette.text.secondary }}>→</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#16A34A', fontWeight: 600 }}>{formatLogValue(field, to)}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function ActivityHistoryPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { setBack, clearBack } = useTopBar();
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBack('Lịch sử thao tác', () => navigate(-1));
    return () => clearBack();
  }, [setBack, clearBack, navigate]);

  const handleSearchChange = (val: string) => {
    setSearchText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val.trim()), 400);
  };

  const clearSearch = () => {
    setSearchText('');
    setDebouncedSearch('');
  };

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['my-work-order-logs', debouncedSearch],
    queryFn: ({ pageParam }) => getMyWorkOrderLogs({ search: debouncedSearch || undefined, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || isFetchingNextPage || !hasNextPage) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
      fetchNextPage();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: 'calc(100dvh - 148px)' }}>
      {!isMobile && (
        <PageHeader title="Lịch sử thao tác" subtitle="Các phiếu thi công bạn đã cập nhật, gần đây nhất trước" />
      )}

      <TextField
        size="small"
        fullWidth
        placeholder="Tìm theo mã trạm hoặc tên trạm..."
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
      />

      <Box ref={scrollRef} onScroll={handleScroll} sx={{ flex: 1, overflowY: 'auto' }}>
        <MobileList loading={isLoading} count={items.length} empty="Không tìm thấy lịch sử thao tác phù hợp">
          {items.map((log) => <LogItem key={log.id} log={log} compact={isMobile} />)}
        </MobileList>
        {isFetchingNextPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={22} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
