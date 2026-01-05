import { Pass, Step } from '../../lib/types'
import RenderIf from '../RenderIf'
import * as VIAM from '@viamrobotics/sdk'
import { StepImagesGrid } from './StepImagesGrid'
import StepVideosGrid from '../StepVideosGrid'
import Button from '../Button'
import { formatDurationToMinutesSeconds } from '../../lib/videoUtils'
import { getStepVideos } from '../../lib/passUtils'
import { BinaryDataManager } from '../../lib/BinaryDataManager'
import { SNAPSHOT_FILE_NAME_PREFIX } from '../../lib/constants'

interface StepsGridProps {
  pass: Pass
  imageFiles: Map<string, VIAM.dataApi.BinaryData>
  videoFiles: Map<string, VIAM.dataApi.BinaryData>
  selectedCamera: string
  machineId: string
  organizationId: string
  fetchTimestamp: Date | null
  videoStoreClient: VIAM.GenericComponentClient | null
  binaryDataManager: BinaryDataManager
  fetchVideos: (start: Date) => Promise<void>
  openBeforeAfterModal: (
    beforeImage: VIAM.dataApi.BinaryData | null,
    afterImage: VIAM.dataApi.BinaryData | null
  ) => void
}
export const StepsGrid = ({
  pass,
  imageFiles,
  videoFiles,
  selectedCamera,
  machineId,
  organizationId,
  fetchTimestamp,
  videoStoreClient,
  binaryDataManager,
  fetchVideos,
  openBeforeAfterModal,
}: StepsGridProps) => {
  return (
    <div className="steps-grid">
      {/* Camera Images */}
      <RenderIf condition={selectedCamera !== ''}>
        <StepImagesGrid
          pass={pass}
          imageFiles={imageFiles}
          selectedCamera={selectedCamera}
          openBeforeAfterModal={openBeforeAfterModal}
        />
      </RenderIf>

      {/* Regular step cards */}
      {pass.steps.map((step: Step) => {
        const stepVideos = getStepVideos(step, videoFiles)

        return (
          <div key={step.name} className="step-card">
            <div className="step-name">{step.name}</div>
            <div className="step-timeline">
              <div className="step-time">
                <span className="time-label">Start</span>
                <span className="time-value">
                  {step.start.toLocaleTimeString()}
                </span>
              </div>
              <div className="timeline-arrow">→</div>
              <div className="step-time">
                <span className="time-label">End</span>
                <span className="time-value">
                  {step.end.toLocaleTimeString()}
                </span>
              </div>
            </div>
            <div className="step-duration">
              {formatDurationToMinutesSeconds(step.start, step.end)}
            </div>

            <StepVideosGrid
              step={step}
              stepVideos={stepVideos}
              videoFiles={videoFiles}
              fetchTimestamp={fetchTimestamp}
              videoStoreClient={videoStoreClient}
              fetchVideos={fetchVideos}
              machineId={machineId}
              organizationId={organizationId}
            />
          </div>
        )
      })}

      {/* View snapshot card */}
      <RenderIf
        condition={
          binaryDataManager.searchBinaryDataByFileName(
            SNAPSHOT_FILE_NAME_PREFIX
          ).length > 0
        }
      >
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
            <Button>View</Button>
          </div>
        </div>
      </RenderIf>
    </div>
  )
}
