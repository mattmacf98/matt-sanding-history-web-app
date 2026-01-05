import { Pass, RobotConfigMetadata } from '../../lib/types'
import { getPassConfigComparison } from '../../lib/configUtils'

export interface PassInfoProps {
  pass: Pass
  groupedPasses: Record<string, Pass[]>
  configMetadata: Map<string, RobotConfigMetadata>
  loadingConfigMetadata: Set<string>
  fetchConfigMetadata: (pass: Pass, prevPass: Pass) => void
  downloadingConfigs: Set<string>
  handleDownloadConfig: (pass: Pass) => void
}

export const PassInfo: React.FC<PassInfoProps> = ({
  pass,
  groupedPasses,
  loadingConfigMetadata,
  configMetadata,
  fetchConfigMetadata,
  downloadingConfigs,
  handleDownloadConfig,
}: PassInfoProps) => {
  const {
    build_info: buildInfo,
    blue_point_count: bluePointCount,
    blue_point_diff_percent: bluePointDiffPercent,
    sanding_distance_mm: sandingDistanceMm,
  } = pass

  return (
    <div className="flex gap-8">
      <div className="info-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <h4 style={{ margin: 0 }}>Blue points</h4>
        </div>
        <div className="info-grid">
          {bluePointCount !== undefined && (
            <div className="info-item">
              <span className="info-label">
                Blue Points
                {bluePointDiffPercent !== undefined && (
                  <span
                    style={{
                      marginLeft: '8px',
                      fontSize: '12px',
                      color: '#6b7280',
                      fontWeight: '500',
                    }}
                  >
                    ({bluePointDiffPercent > 0 ? '+' : ''}
                    {bluePointDiffPercent.toFixed(1)}
                    %)
                  </span>
                )}
              </span>
              <span className="info-value">
                {bluePointCount.toLocaleString()}
              </span>
            </div>
          )}

          {sandingDistanceMm !== undefined && (
            <div className="info-item">
              <span className="info-label">Sanding Distance</span>
              <span className="info-value">
                {sandingDistanceMm >= 1000
                  ? `${(sandingDistanceMm / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m`
                  : `${sandingDistanceMm.toFixed(1)} mm`}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="info-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <h4 style={{ margin: 0 }}>Build information</h4>
        </div>

        {buildInfo?.version ||
        buildInfo?.git_revision ||
        buildInfo?.date_compiled ? (
          <div className="info-grid">
            {/* Version */}
            {buildInfo?.version && (
              <div className="info-item">
                <span className="info-label">Version</span>
                <span className="info-value">{buildInfo?.version}</span>
              </div>
            )}

            {/* Git Revision */}
            {buildInfo?.git_revision && (
              <div className="info-item">
                <span className="info-label">Git revision</span>
                <span className="info-value">{buildInfo?.git_revision}</span>
              </div>
            )}

            {/* Date Compiled */}
            {buildInfo?.date_compiled && (
              <div className="info-item">
                <span className="info-label">Date compiled</span>
                <span className="info-value">{buildInfo?.date_compiled}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="info-notice">
            Build information not available for this run.
          </div>
        )}
      </div>
      <div className="info-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <h4 style={{ margin: 0 }}>Config information</h4>
          {(() => {
            const flatPasses = Object.values(groupedPasses).flat()
            const { prevPass, configChanged } = getPassConfigComparison(
              pass,
              flatPasses,
              configMetadata
            )

            // If the previous pass exists but we don't have its metadata yet,
            // trigger a fetch. The UI will update on the next render cycle.
            if (
              prevPass &&
              !configMetadata.has(prevPass.pass_id) &&
              !loadingConfigMetadata.has(prevPass.pass_id)
            ) {
              fetchConfigMetadata(pass, prevPass)
            }

            // Only show the badge if the metadata for both passes has been loaded and they are different.
            if (configChanged) {
              return (
                <div
                  style={{
                    marginLeft: '12px',
                    fontSize: '12px',
                    color: '#4f46e5',
                    backgroundColor: '#eef2ff',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontWeight: 500,
                  }}
                >
                  Config changed since last run
                </div>
              )
            }
            return null
          })()}
        </div>

        {loadingConfigMetadata.has(pass.pass_id) ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
              color: '#6b7280',
              fontSize: '14px',
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(59, 130, 246, 0.2)',
                borderTop: '2px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            Loading config info...
          </div>
        ) : configMetadata.has(pass.pass_id) ? (
          <div className="info-grid" style={{ marginBottom: '12px' }}>
            {(() => {
              const metadata = configMetadata.get(pass.pass_id)!
              return (
                <>
                  <div className="info-item">
                    <span className="info-label">Timestamp</span>
                    <span className="info-value">
                      {metadata.configTimestamp.toLocaleString()}
                    </span>
                  </div>
                  <div className="info-item">
                    <button
                      onClick={() => handleDownloadConfig(pass)}
                      disabled={downloadingConfigs.has(pass.pass_id)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: downloadingConfigs.has(pass.pass_id)
                          ? '#9ca3af'
                          : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: downloadingConfigs.has(pass.pass_id)
                          ? 'not-allowed'
                          : 'pointer',
                        transition: 'background-color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      onMouseEnter={(e) => {
                        if (!downloadingConfigs.has(pass.pass_id)) {
                          e.currentTarget.style.backgroundColor = '#2563eb'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!downloadingConfigs.has(pass.pass_id)) {
                          e.currentTarget.style.backgroundColor = '#3b82f6'
                        }
                      }}
                    >
                      {downloadingConfigs.has(pass.pass_id) ? (
                        <>
                          <div
                            style={{
                              width: '12px',
                              height: '12px',
                              border: '2px solid #ffffff',
                              borderTop: '2px solid transparent',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite',
                            }}
                          />
                          Downloading...
                        </>
                      ) : (
                        <>Download config</>
                      )}
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        ) : null}
      </div>
    </div>
  )
}
