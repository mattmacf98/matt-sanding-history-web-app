import { Pass, PassDiagnosis, PassNote } from '../../lib/types'
import { formatDurationToMinutesSeconds } from '../../lib/videoUtils'
import { StatusBadge } from '../StatusBadge'

interface CollapsedRowProps {
  passId: string
  globalIndex: string
  execMs: number
  toggleRowExpansion: (index: string) => void
  expandedRows: Set<string>
  passNotesData: PassNote[]
  passDiagnoses: Map<string, PassDiagnosis>
  pass: Pass
  expandedErrors: Set<string>
  setExpandedErrors: React.Dispatch<React.SetStateAction<Set<string>>>
}

export const CollapsedRow = ({
  passId,
  globalIndex,
  execMs,
  toggleRowExpansion,
  expandedRows,
  passNotesData,
  passDiagnoses,
  pass,
  expandedErrors,
  setExpandedErrors,
}: CollapsedRowProps) => {
  return (
    <tr
      className="expandable-row"
      onClick={() => toggleRowExpansion(globalIndex)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggleRowExpansion(globalIndex)
        }
      }}
      aria-expanded={expandedRows.has(globalIndex)}
      aria-label={`${
        expandedRows.has(globalIndex) ? 'Collapse' : 'Expand'
      } details for pass from ${pass.start.toLocaleTimeString()}`}
    >
      <td>
        <span
          className={`expand-icon ${
            expandedRows.has(globalIndex) ? 'expanded' : ''
          }`}
          aria-hidden="true"
        >
          ▶
        </span>
      </td>
      <td className="text-zinc-700">{pass.start.toLocaleDateString()}</td>
      <td className="text-zinc-700 text-xs">
        {pass.pass_id ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(pass.pass_id)
                // Show copied feedback
                const btn = e.currentTarget
                const svg = btn.querySelector('svg')
                const textSpan = btn.querySelector('span')
                // Change to green success state
                btn.style.backgroundColor = '#dcfce7'
                btn.style.color = '#166534'
                if (svg) {
                  svg.innerHTML =
                    '<path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />'
                  svg.style.fill = '#166534'
                }
                if (textSpan) {
                  textSpan.style.color = '#166534'
                }
                setTimeout(() => {
                  btn.style.backgroundColor = '#f3f4f6'
                  btn.style.color = ''
                  if (svg) {
                    svg.innerHTML =
                      '<path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />'
                    svg.style.fill = '#9ca3af'
                  }
                  if (textSpan) {
                    textSpan.style.color = '#52525b'
                  }
                }, 1500)
              }}
              className="inline-flex items-center justify-center py-1 rounded text-xs font-medium cursor-pointer"
              title={`Copy pass ID: ${pass.pass_id}`}
              style={{
                backgroundColor: '#f3f4f6',
                border: 'none',
                gap: '6px',
                paddingLeft: '10px',
                paddingRight: '10px',
                transition: 'background-color 0.15s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                const btn = e.currentTarget
                const svg = btn.querySelector('svg')
                const textSpan = btn.querySelector('span')
                if (btn.style.backgroundColor !== 'rgb(220, 252, 231)') {
                  // not in success state
                  btn.style.backgroundColor = '#dbeafe'
                  if (svg) svg.style.fill = '#2563eb'
                  if (textSpan) textSpan.style.color = '#2563eb'
                }
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget
                const svg = btn.querySelector('svg')
                const textSpan = btn.querySelector('span')
                if (btn.style.backgroundColor !== 'rgb(220, 252, 231)') {
                  // not in success state
                  btn.style.backgroundColor = '#f3f4f6'
                  if (svg) svg.style.fill = '#9ca3af'
                  if (textSpan) textSpan.style.color = '#52525b'
                }
              }}
            >
              <span
                style={{
                  fontFamily:
                    'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace',
                  color: '#52525b',
                  fontSize: '11px',
                }}
              >
                {pass.pass_id.substring(0, 8)}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                style={{
                  width: '12px',
                  height: '12px',
                  fill: '#9ca3af',
                  transition: 'fill 0.15s ease',
                }}
              >
                <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
              </svg>
            </button>
            {(() => {
              const hasNotes =
                passNotesData.length > 0 && passNotesData[0].note_text.trim()
              const diagnosisData = passDiagnoses.get(passId)
              const hasDiagnosis =
                diagnosisData && (diagnosisData.symptom || diagnosisData.cause)

              if (hasNotes || hasDiagnosis) {
                return (
                  <span
                    style={{
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title={
                      hasNotes && hasDiagnosis
                        ? 'This pass has notes and diagnosis'
                        : hasNotes
                          ? 'This pass has notes'
                          : 'This pass has diagnosis'
                    }
                  >
                    📝
                  </span>
                )
              }
              return null
            })()}
          </div>
        ) : (
          '—'
        )}
      </td>
      <td>
        <StatusBadge success={pass.success} />
      </td>
      <td className="text-zinc-700">{pass.start.toLocaleTimeString()}</td>
      <td className="text-zinc-700">{pass.end.toLocaleTimeString()}</td>
      <td className="text-zinc-700">
        {formatDurationToMinutesSeconds(pass.start, pass.end)}
      </td>
      <td className="text-zinc-700">
        {formatDurationToMinutesSeconds(new Date(0), new Date(execMs))}
      </td>
      <td className="text-zinc-700">
        {pass.blue_point_count !== undefined
          ? pass.blue_point_count.toLocaleString()
          : '—'}
      </td>
      <td className="text-zinc-700">
        {pass.steps ? `${pass.steps.length} steps` : '—'}
      </td>
      <td className="text-zinc-700">
        {pass.selected_zones !== undefined
          ? (() => {
              const zones = Array.isArray(pass.selected_zones)
                ? pass.selected_zones
                : [pass.selected_zones]

              const zoneNumbers = zones
                .map((zone) => {
                  const str = String(zone)
                  return str.startsWith('zone_')
                    ? str.replace('zone_', '')
                    : str
                })
                .map((zone) => parseInt(zone, 10))
                .filter((num) => !isNaN(num))
                .sort((a, b) => a - b)

              return zoneNumbers.length > 0 ? zoneNumbers.join(', ') : '—'
            })()
          : '—'}
      </td>
      <td className="text-zinc-700">
        {pass.selected_num_rounds !== undefined
          ? pass.selected_num_rounds
          : '—'}
      </td>
      <td className="text-zinc-700">
        {pass.err_string ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '4px',
            }}
          >
            <span
              className="text-red-600 text-xxs font-mono error-text"
              title={pass.err_string}
              style={{
                display: 'block',
                maxWidth: '100%',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {expandedErrors.has(pass.pass_id)
                ? pass.err_string
                : pass.err_string.length > 200
                  ? `${pass.err_string.substring(0, 200)}...`
                  : pass.err_string}
            </span>
            {pass.err_string.length > 200 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setExpandedErrors((prev: Set<string>) => {
                    const newSet = new Set(prev)
                    if (newSet.has(pass.pass_id)) {
                      newSet.delete(pass.pass_id)
                    } else {
                      newSet.add(pass.pass_id)
                    }
                    return newSet
                  })
                }}
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  backgroundColor: '#eee',
                  color: '#db5353ff',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  fontWeight: 'bold',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#db5353ff'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#eee'
                  e.currentTarget.style.color = '#db5353ff'
                }}
              >
                {expandedErrors.has(pass.pass_id) ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
    </tr>
  )
}
