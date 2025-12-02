import React from 'react';
import Spinner from './Spinner';

interface GlobalLoadingIndicatorProps {
  isLoading: boolean;
  currentDate?: Date | null;
  fileCount?: number;
}

const GlobalLoadingIndicator: React.FC<GlobalLoadingIndicatorProps> = ({
  isLoading,
  currentDate,
  fileCount
}) => {
  if (!isLoading) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: 'white',
      padding: '16px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      zIndex: 9999,
      border: '1px solid #e5e7eb',
      animation: 'slideIn 0.3s ease-out',
      maxWidth: '350px'
    }}>
      <div style={{ flexShrink: 0 }}>
        <Spinner size="24px" borderWidth="3px" />
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{
          fontSize: '14px',
          color: '#111827',
          fontWeight: 600
        }}>
          Fetching binary data...
        </span>
        
        {currentDate && (
          <span style={{
            fontSize: '12px',
            color: '#6b7280'
          }}>
            Processing: {currentDate.toLocaleDateString()} {currentDate.toLocaleTimeString()}
          </span>
        )}
        
        {fileCount !== undefined && (
          <span style={{
            fontSize: '12px',
            color: '#6b7280'
          }}>
            {fileCount.toLocaleString()} files loaded
          </span>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default GlobalLoadingIndicator;
