import React from 'react'
import SnapshotComponent from './Snapshot/Snapshot'
import { SnapshotProto } from '@viamrobotics/motion-tools/lib'

interface SnapshotModalProps {
  close: () => void
  snapshot: SnapshotProto
}

const SnapshotModal: React.FC<SnapshotModalProps> = ({ close, snapshot }) => {
  return (
    <div
      className="snapshot-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={close}
    >
      <div
        className="snapshot-modal-content"
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 32,
          minWidth: '90vw',
          minHeight: '85vh',
          maxWidth: '98vw',
          maxHeight: '98vh',
          width: '90vw',
          height: '85vh',
          overflowY: 'auto',
          position: 'relative',
          boxShadow: '0 2px 24px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="snapshot-modal-close"
          style={{
            position: 'absolute',
            top: 16,
            right: 24,
            background: 'transparent',
            border: 'none',
            fontSize: 32,
            cursor: 'pointer',
            lineHeight: '1',
          }}
          aria-label="Close"
        >
          &times;
        </button>
        <div style={{ width: '100%', height: '100%' }}>
          <SnapshotComponent snapshot={snapshot} />
        </div>
      </div>
    </div>
  )
}

export default SnapshotModal
