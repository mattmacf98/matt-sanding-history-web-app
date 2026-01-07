import React from 'react'
import SnapshotComponent from './Snapshot/Snapshot'
import { SnapshotProto } from '@viamrobotics/motion-tools/lib'
import { useEffect } from 'react'

interface SnapshotModalProps {
  close: () => void
  snapshot: SnapshotProto
}

const SnapshotModal: React.FC<SnapshotModalProps> = ({ close, snapshot }) => {
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }

    document.addEventListener('keydown', handleEscapeKey)

    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [])

  return (
    <div
      className="fixed inset-0 w-screen h-screen bg-black/50 z-1000 flex items-center justify-center"
      onClick={close}
    >
      <div
        className="bg-white rounded-2xl p-8 min-w-[90vw] min-h-[85vh] max-w-[98vw] max-h-[98vh] w-[90vw] h-[85vh] overflow-y-auto relative shadow-[0_2px_24px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-4 right-6 bg-transparent border-none text-[32px] cursor-pointer leading-none"
          aria-label="Close"
        >
          &times;
        </button>
        <div className="w-full h-full">
          <SnapshotComponent snapshot={snapshot} />
        </div>
      </div>
    </div>
  )
}

export default SnapshotModal
