import React from 'react';
import EmbedMotionTools from '../MotionTools/embed-motion-tools.svelte';
import useSvelte from '../../lib/hooks/useSvelte';

// Create the wrapper once at module level, not on every render
const MotionTools = useSvelte(EmbedMotionTools);

interface SnapshotModalProps {
  close: () => void;
}

const SnapshotModal: React.FC<SnapshotModalProps> = ({ close }) => {

  return (
    <div
      className="snapshot-modal-backdrop"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={close}
    >
      <div
        className="snapshot-modal-content"
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 24,
          minWidth: 320,
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflowY: "auto",
          position: "relative"
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="snapshot-modal-close"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "transparent",
            border: "none",
            fontSize: 24,
            cursor: "pointer",
            lineHeight: "1"
          }}
          aria-label="Close"
        >&times;</button>
        <MotionTools />
      </div>
    </div>
  );
};

export default SnapshotModal;
