import { createContext, useContext, useState, ReactNode } from 'react'
import { SnapshotProto } from '@viamrobotics/motion-tools/lib'
import SnapshotModal from '../../components/SnapshotModal'

// Define modal types
export enum ModalType {
  SNAPSHOT = 'snapshot',
}

// Define props for each modal type
interface SnapshotModalData {
  type: ModalType.SNAPSHOT
  snapshot: SnapshotProto
}

// Discriminated union of all modal configs
export type ModalData = SnapshotModalData

interface ModalContextType {
  openModal: (data: ModalData) => void
  closeModal: () => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalData, setModalData] = useState<ModalData | null>(null)

  const openModal = (data: ModalData) => setModalData(data)
  const closeModal = () => setModalData(null)

  const renderModal = () => {
    if (!modalData) return null

    if (modalData.type === ModalType.SNAPSHOT) {
      return <SnapshotModal close={closeModal} snapshot={modalData.snapshot} />
    }

    return null
  }

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {renderModal()}
      {children}
    </ModalContext.Provider>
  )
}

export function useModal() {
  const context = useContext(ModalContext)
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}
