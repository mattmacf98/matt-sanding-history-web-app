import Button from '../Button'
import { ModalType, useModal } from '../../lib/contexts/ModalContext'
import { SnapshotProto } from '@viamrobotics/motion-tools/lib'
import { BinaryDataFile } from '../../lib/BinaryDataFile'

interface StepsVizSnapshotCardProps {
  snapshotFile: BinaryDataFile
}
export const StepsVizSnapshotCard = ({
  snapshotFile,
}: StepsVizSnapshotCardProps) => {
  const { openModal } = useModal()

  return (
    <div className="step-card">
      <div className="step-name">View Snapshot</div>
      <p>Load and display a 3D scene from a snapshot file.</p>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Button
          onClick={() => {
            openModal({
              type: ModalType.SNAPSHOT,
              snapshot: new SnapshotProto(
                snapshotFile.binaryData.toJson() as Partial<SnapshotProto>
              ),
            })
          }}
        >
          View
        </Button>
      </div>
    </div>
  )
}
