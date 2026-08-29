import React from 'react';
import { Box, TextField, InputAdornment } from '@mui/material';
import { SearchOutlined } from '@mui/icons-material';
import { palette, radius } from '../../theme/tokens';

interface Props {
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  searchWidth?: number;
  children?: React.ReactNode;
  endSlot?: React.ReactNode;
}

export default function Toolbar({
  search, onSearch, searchPlaceholder = 'Tìm kiếm...', searchWidth = 280, children, endSlot,
}: Props) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.25,
        alignItems: 'center',
        flexWrap: 'wrap',
        p: { xs: 1, sm: 1.25 },
        bgcolor: palette.card,
        border: `1px solid ${palette.border}`,
        borderRadius: `${radius.card}px`,
        boxShadow: '0 1px 2px rgba(15,27,45,0.04)',
      }}
    >
      {onSearch && (
        <TextField
          size="small"
          placeholder={searchPlaceholder}
          value={search ?? ''}
          onChange={(e) => onSearch(e.target.value)}
          sx={{ width: { xs: '100%', sm: searchWidth }, maxWidth: '100%' }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined sx={{ fontSize: 18, color: palette.text.muted }} />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
      {children && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          {children}
        </Box>
      )}
      {endSlot && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: { xs: 0, sm: 'auto' }, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          {endSlot}
        </Box>
      )}
    </Box>
  );
}
