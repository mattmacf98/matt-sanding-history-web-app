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
      bottom: '24px',
      right: '24px',
      backgroundColor: 'rgba(0, 0, 0, 0.88)',
      padding: '12px 16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 9999,
      animation: 'toastSlideIn 0.3s cubic-bezier(0.21, 1.02, 0.73, 1)',
      minWidth: '280px'
    }}>
      <div style={{ flexShrink: 0 }}>
        <Spinner size="16px" borderWidth="2px" color="#46beffff" />
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
        <span style={{
          fontSize: '14px',
          color: '#fafafa',
          fontWeight: 500
        }}>
          Fetching binary data...
        </span>
        
        <span style={{
          fontSize: '12px',
          color: '#a1a1aa'
        }}>
          {currentDate && (
            <>{currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {currentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
          )}
          {currentDate && fileCount !== undefined && fileCount > 0 && ' · '}
          {fileCount !== undefined && fileCount > 0 && (
            <>{fileCount.toLocaleString()} files</>
          )}
        </span>
      </div>

      <style>{`
        @keyframes toastSlideIn {
          from { 
            transform: translateY(100%);
            opacity: 0;
          }
          to { 
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default GlobalLoadingIndicator;
