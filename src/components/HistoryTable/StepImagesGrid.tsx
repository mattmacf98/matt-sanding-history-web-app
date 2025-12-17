import { getBeforeAfterImages } from '../../lib/passUtils'
import { Pass } from '../../lib/types'
import { formatTimeDifference } from '../../lib/videoUtils'
import ImageDisplay from '../ImageDisplay'
import * as VIAM from '@viamrobotics/sdk'

interface StepImagesGridProps {
  pass: Pass
  imageFiles: Map<string, VIAM.dataApi.BinaryData>
  selectedCamera: string
  openBeforeAfterModal: (
    beforeImage: VIAM.dataApi.BinaryData | null,
    afterImage: VIAM.dataApi.BinaryData | null
  ) => void
}

export const StepImagesGrid = ({
  pass,
  imageFiles,
  selectedCamera,
  openBeforeAfterModal,
}: StepImagesGridProps) => {
  const { beforeImage, afterImage } = getBeforeAfterImages(
    pass,
    imageFiles,
    selectedCamera
  )
  const passStart = pass.start
  const passEnd = pass.end

  // If no images at all, show a message
  if (!beforeImage && !afterImage) {
    return (
      <div className="step-card" style={{ order: 0 }}>
        <div
          style={{
            display: 'flex',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f3f4f6',
            borderRadius: '4px',
            padding: '12px',
            color: '#9ca3af',
            fontSize: '14px',
          }}
        >
          No images captured during this pass
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Start Image */}
      {beforeImage && (
        <div className="step-card" style={{ order: -1 }}>
          <div className="step-name">Start Image</div>
          <div className="step-duration">
            {beforeImage.metadata?.timeRequested?.toDate().toLocaleTimeString()}
            <span
              style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}
            >
              (
              {formatTimeDifference(
                beforeImage.metadata?.timeRequested?.toDate()?.getTime() ||
                  passStart.getTime(),
                passStart.getTime()
              )}{' '}
              from start)
            </span>
          </div>

          <div
            className="step-image-container clickable-image"
            style={{ marginTop: '12px', width: '100%', overflow: 'hidden' }}
            onClick={() => openBeforeAfterModal(beforeImage, afterImage)}
          >
            <ImageDisplay binaryData={beforeImage} />
          </div>
        </div>
      )}

      {/* End Image */}
      {afterImage && afterImage !== beforeImage && (
        <div className="step-card" style={{ order: 999 }}>
          <div className="step-name">End Image</div>
          <div className="step-duration">
            {afterImage.metadata?.timeRequested?.toDate().toLocaleTimeString()}
            <span
              style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}
            >
              (
              {formatTimeDifference(
                passEnd.getTime(),
                afterImage.metadata?.timeRequested?.toDate()?.getTime() ||
                  passEnd.getTime()
              )}{' '}
              before end)
            </span>
          </div>

          <div
            className="step-image-container clickable-image"
            style={{ marginTop: '12px', width: '100%', overflow: 'hidden' }}
            onClick={() => openBeforeAfterModal(beforeImage, afterImage)}
          >
            <ImageDisplay binaryData={afterImage} />
          </div>
        </div>
      )}
    </>
  )
}
