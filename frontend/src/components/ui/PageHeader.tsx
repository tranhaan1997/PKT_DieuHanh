import React from 'react';
import { Box, Typography } from '@mui/material';

interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="h1"
          sx={{ fontSize: { xs: '1.125rem', sm: '1.375rem' }, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.015em', color: 'text.primary' }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mt: 0.375, display: { xs: 'none', sm: 'block' } }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box sx={{
          display: 'flex', gap: 1, flexShrink: 0, flexWrap: 'wrap',
          '& .MuiButton-root': {
            fontSize: { xs: '0.75rem', sm: '0.875rem' },
            px: { xs: 1.25, sm: 2 },
            py: { xs: 0.5, sm: 0.75 },
            minHeight: { xs: 32, sm: 36 },
            '& .MuiButton-startIcon svg': { fontSize: { xs: 16, sm: 20 } },
          },
        }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}
