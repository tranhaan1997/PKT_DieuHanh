import { useRef, useState, useEffect } from 'react';
import Draggable from 'react-draggable';
import Paper, { type PaperProps } from '@mui/material/Paper';

const BREAKPOINT_PX: Record<string, number> = { Xs: 444, Sm: 600, Md: 900, Lg: 1200, Xl: 1536 };

function getBreakpointMaxPx(className?: string): number | undefined {
  const m = className?.match(/MuiDialog-paperWidth(Xs|Sm|Md|Lg|Xl)/);
  return m ? BREAKPOINT_PX[m[1]] : undefined;
}

/**
 * Cho phép kéo dialog bằng cách nắm giữ DialogTitle.
 * Dùng làm PaperComponent cho mọi MuiDialog (xem theme/index.ts).
 * Bỏ qua khi dialog đang fullScreen (mobile) — không có chỗ để kéo tới.
 *
 * react-draggable không tương thích với width tính theo % (MUI dùng
 * `width: calc(100% - 64px)` cho prop `fullWidth`) — kết hợp với transform
 * khi kéo sẽ làm dialog phình ngang sau khi nội dung load. Khoá lại bằng
 * giá trị px cố định (tính từ viewport, cập nhật khi resize) để tránh lỗi này.
 */
export default function DraggablePaper(props: PaperProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [pinnedWidth, setPinnedWidth] = useState<number>();

  const isFullScreen = props.className?.includes('MuiDialog-paperFullScreen');
  const isFullWidth = props.className?.includes('MuiDialog-paperFullWidth');
  const breakpointMaxPx = getBreakpointMaxPx(props.className);

  useEffect(() => {
    if (isFullScreen || !isFullWidth) return;
    const compute = () => setPinnedWidth(Math.min(window.innerWidth - 64, breakpointMaxPx ?? Infinity));
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [isFullScreen, isFullWidth, breakpointMaxPx]);

  if (isFullScreen) {
    return <Paper {...props} />;
  }

  return (
    <Draggable
      nodeRef={nodeRef as React.RefObject<HTMLElement>}
      handle=".MuiDialogTitle-root"
      cancel={'[class*="MuiDialogContent-root"], [class*="MuiDialogActions-root"], button, a'}
    >
      <Paper
        {...props}
        ref={nodeRef}
        style={{
          ...props.style,
          ...(pinnedWidth ? { width: pinnedWidth, maxWidth: pinnedWidth } : {}),
          maxHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      />
    </Draggable>
  );
}
