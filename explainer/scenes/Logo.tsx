import React from 'react';
import { useTheme } from '@explainer/src/kit/theme';

/** Muesli's mark, as the GUI's sidebar draws it (.brand-dot in web/style.css): an accent ring around a dark centre. */
export const Logo: React.FC<{ size: number }> = ({ size }) => {
  const theme = useTheme();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: `radial-gradient(circle at 50% 50%, ${theme.bg0} 0 32%, ${theme.accent} 34% 100%)`,
        boxShadow: `0 0 ${Math.round(size * 0.55)}px ${theme.accent}55`,
      }}
    />
  );
};
