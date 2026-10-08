import { Box } from '@mui/material';

/** Hiển thị chuỗi có quy ước `X_{abc}` thành X với chỉ số dưới (xem calculators/symbols.ts) */
export default function MathText({ text }: { text?: string }) {
  if (!text) return null;
  const parts = text.split(/_\{([^}]*)\}/);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <Box key={i} component="sub" sx={{ fontSize: '0.75em', lineHeight: 0 }}>{p}</Box>
        ) : (
          p
        ),
      )}
    </>
  );
}
