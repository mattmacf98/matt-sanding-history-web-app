import React from 'react';

interface SpinnerProps {
  size?: string;
  color?: string;
  borderWidth?: string;
}

const Spinner: React.FC<SpinnerProps> = ({
  size = '28px',
  color = '#3b82f6',
  borderWidth = '3px',
}) => {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `${borderWidth} solid rgba(59, 130, 246, 0.2)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
  );
};

export default Spinner;
