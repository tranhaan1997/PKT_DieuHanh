import { useRef, useState } from 'react';
import { Box, Snackbar, Alert } from '@mui/material';

const LONG_PRESS_MS = 500;

/** Bọc quanh 1 label — nhấn giữ (mobile) để copy giá trị vào clipboard. */
export default function LongPressCopy({ value, children, sx }: {
  value?: string | null;
  children: React.ReactNode;
  sx?: object;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };

  const start = () => {
    if (!value) return;
    fired.current = false;
    clear();
    timer.current = setTimeout(() => {
      fired.current = true;
      navigator.clipboard?.writeText(value).then(() => setCopied(true)).catch(() => {});
    }, LONG_PRESS_MS);
  };

  return (
    <>
      <Box
        component="span"
        onTouchStart={(e) => { e.stopPropagation(); start(); }}
        onTouchEnd={(e) => { if (fired.current) e.stopPropagation(); clear(); }}
        onTouchMove={clear}
        onContextMenu={(e) => { if (value) e.preventDefault(); }}
        sx={sx}
      >
        {children}
      </Box>
      <Snackbar open={copied} autoHideDuration={1800} onClose={() => setCopied(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setCopied(false)} sx={{ fontSize: '0.8rem' }}>
          Đã copy "{value}"
        </Alert>
      </Snackbar>
    </>
  );
}
