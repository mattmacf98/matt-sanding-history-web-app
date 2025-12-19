import { Pass, PassDiagnosis, PassNote } from '../../lib/types'
import { CAUSE_OPTIONS, SYMPTOM_OPTIONS } from '../../lib/types'

export interface DiagnosisProps {
  pass: Pass
  jiraValidationErrors: Record<string, string>
  passId: string
  fetchingNotes: boolean
  passNotesData: PassNote[]
  diagnosisInputs: Record<
    string,
    { symptom?: string; cause?: string; jiraTicketUrl?: string }
  >
  savingMetadata: Set<string>
  metadataSuccess: Set<string>
  savePassMetadata: (passId: string, isFailedPass: boolean) => void
  passDiagnoses: Map<string, PassDiagnosis>
  handleDiagnosisChange: (
    passId: string,
    field: 'symptom' | 'cause' | 'jiraTicketUrl',
    value: string
  ) => void
  noteInputs: Record<string, string>
  handleNoteChange: (passId: string, value: string) => void
}
export const Diagnosis: React.FC<DiagnosisProps> = ({
  pass,
  passId,
  savingMetadata,
  metadataSuccess,
  passNotesData,
  savePassMetadata,
  passDiagnoses,
  fetchingNotes,
  diagnosisInputs,
  jiraValidationErrors,
  handleDiagnosisChange,
  noteInputs,
  handleNoteChange,
}: DiagnosisProps) => {
  return (
    <div style={{ margin: '1rem 12px 24px 12px' }}>
      <div
        className="step-card"
        style={{
          minWidth: '50%',
          backgroundColor: 'transparent',
        }}
      >
        <div className="step-name" style={{ textAlign: 'left' }}>
          {!pass.success ? 'Diagnosis' : 'Notes'}
        </div>

        {fetchingNotes ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '80px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '20px',
                height: '20px',
                border: '2px solid rgba(59, 130, 246, 0.2)',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            ></span>
            <span
              style={{
                marginLeft: '10px',
                color: '#6b7280',
                fontSize: '14px',
              }}
            >
              Loading...
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Diagnosis dropdowns - only for failed passes, displayed in a row */}
            {!pass.success && (
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <label
                    htmlFor={`symptom-${passId}`}
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: '6px',
                    }}
                  >
                    Symptom
                  </label>
                  <select
                    id={`symptom-${passId}`}
                    value={diagnosisInputs[passId]?.symptom || ''}
                    onChange={(e) =>
                      handleDiagnosisChange(passId, 'symptom', e.target.value)
                    }
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="">Select symptom...</option>
                    {SYMPTOM_OPTIONS.map((option: string) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label
                    htmlFor={`cause-${passId}`}
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#374151',
                      marginBottom: '6px',
                    }}
                  >
                    Cause
                  </label>
                  <select
                    id={`cause-${passId}`}
                    value={diagnosisInputs[passId]?.cause || ''}
                    onChange={(e) =>
                      handleDiagnosisChange(passId, 'cause', e.target.value)
                    }
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="">Select cause...</option>
                    {CAUSE_OPTIONS.map((option: string) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* JIRA Ticket URL - only for failed passes when cause is selected */}
            {!pass.success && diagnosisInputs[passId]?.cause && (
              <div>
                <label
                  htmlFor={`jira-${passId}`}
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '6px',
                  }}
                >
                  JIRA Ticket (e.g. https://viam.atlassian.net/browse/RSDK-1234)
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <input
                    id={`jira-${passId}`}
                    type="url"
                    value={diagnosisInputs[passId]?.jiraTicketUrl || ''}
                    onChange={(e) =>
                      handleDiagnosisChange(
                        passId,
                        'jiraTicketUrl',
                        e.target.value
                      )
                    }
                    placeholder="https://viam.atlassian.net/browse/RSDK-..."
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      fontSize: '14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      outline: 'none',
                    }}
                  />
                  {diagnosisInputs[passId]?.jiraTicketUrl &&
                    !jiraValidationErrors[passId] && (
                      <a
                        href={diagnosisInputs[passId].jiraTicketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '10px 12px',
                          fontSize: '14px',
                          color: '#3b82f6',
                          textDecoration: 'none',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Open JIRA ticket"
                      >
                        🔗
                      </a>
                    )}
                </div>
                {jiraValidationErrors[passId] && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#dc2626',
                      marginTop: '4px',
                    }}
                  >
                    {jiraValidationErrors[passId]}
                  </div>
                )}
              </div>
            )}

            {/* Notes textarea - always shown */}
            <div>
              {/* Only show label when there are diagnosis fields above */}
              {!pass.success && (
                <label
                  htmlFor={`pass-notes-${passId}`}
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '6px',
                  }}
                >
                  Notes
                </label>
              )}
              <textarea
                id={`pass-notes-${passId}`}
                value={noteInputs[passId] || ''}
                onChange={(e) => handleNoteChange(passId, e.target.value)}
                placeholder="Add a note for this pass..."
                style={{
                  width: '100%',
                  minHeight: '72px',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box',
                  outline: 'none',
                  lineHeight: '1.5',
                }}
                aria-label={`Notes for pass ${passId}`}
              />
            </div>

            {/* Save button - full width at bottom */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => savePassMetadata(passId, !pass.success)}
                disabled={(() => {
                  if (savingMetadata.has(passId) || metadataSuccess.has(passId))
                    return true
                  // Disable if there are JIRA validation errors
                  if (jiraValidationErrors[passId]) return true
                  const noteText = noteInputs[passId] || ''
                  const existingNoteText =
                    passNotesData.length > 0 ? passNotesData[0].note_text : ''
                  const noteChanged =
                    noteText.trim() !== existingNoteText.trim()
                  if (!pass.success) {
                    const diagnosisChanged =
                      (passDiagnoses.get(passId)?.symptom || '') !==
                        (diagnosisInputs[passId]?.symptom || '') ||
                      (passDiagnoses.get(passId)?.cause || '') !==
                        (diagnosisInputs[passId]?.cause || '') ||
                      (passDiagnoses.get(passId)?.jira_ticket_url || '') !==
                        (diagnosisInputs[passId]?.jiraTicketUrl || '')
                    return !noteChanged && !diagnosisChanged
                  }
                  return !noteChanged
                })()}
                style={{
                  padding: '6px 8px',
                  fontSize: '12px',
                  color: 'white',
                  backgroundColor: metadataSuccess.has(passId)
                    ? '#10b981'
                    : (() => {
                        if (savingMetadata.has(passId)) return '#9ca3af'
                        const noteText = noteInputs[passId] || ''
                        const existingNoteText =
                          passNotesData.length > 0
                            ? passNotesData[0].note_text
                            : ''
                        const noteChanged =
                          noteText.trim() !== existingNoteText.trim()
                        if (!pass.success) {
                          const diagnosisChanged =
                            (passDiagnoses.get(passId)?.symptom || '') !==
                              (diagnosisInputs[passId]?.symptom || '') ||
                            (passDiagnoses.get(passId)?.cause || '') !==
                              (diagnosisInputs[passId]?.cause || '') ||
                            (passDiagnoses.get(passId)?.jira_ticket_url ||
                              '') !==
                              (diagnosisInputs[passId]?.jiraTicketUrl || '')
                          return noteChanged || diagnosisChanged
                            ? '#3b82f6'
                            : '#9ca3af'
                        }
                        return noteChanged ? '#3b82f6' : '#9ca3af'
                      })(),
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (() => {
                    if (
                      savingMetadata.has(passId) ||
                      metadataSuccess.has(passId)
                    )
                      return 'not-allowed'
                    const noteText = noteInputs[passId] || ''
                    const existingNoteText =
                      passNotesData.length > 0 ? passNotesData[0].note_text : ''
                    const noteChanged =
                      noteText.trim() !== existingNoteText.trim()
                    if (!pass.success) {
                      const diagnosisChanged =
                        (passDiagnoses.get(passId)?.symptom || '') !==
                          (diagnosisInputs[passId]?.symptom || '') ||
                        (passDiagnoses.get(passId)?.cause || '') !==
                          (diagnosisInputs[passId]?.cause || '') ||
                        (passDiagnoses.get(passId)?.jira_ticket_url || '') !==
                          (diagnosisInputs[passId]?.jiraTicketUrl || '')
                      return noteChanged || diagnosisChanged
                        ? 'pointer'
                        : 'not-allowed'
                    }
                    return noteChanged ? 'pointer' : 'not-allowed'
                  })(),
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => {
                  const noteText = noteInputs[passId] || ''
                  const existingNoteText =
                    passNotesData.length > 0 ? passNotesData[0].note_text : ''
                  const noteChanged =
                    noteText.trim() !== existingNoteText.trim()
                  let hasChanges = noteChanged
                  if (!pass.success) {
                    const diagnosisChanged =
                      (passDiagnoses.get(passId)?.symptom || '') !==
                        (diagnosisInputs[passId]?.symptom || '') ||
                      (passDiagnoses.get(passId)?.cause || '') !==
                        (diagnosisInputs[passId]?.cause || '') ||
                      (passDiagnoses.get(passId)?.jira_ticket_url || '') !==
                        (diagnosisInputs[passId]?.jiraTicketUrl || '')
                    hasChanges = noteChanged || diagnosisChanged
                  }
                  if (
                    hasChanges &&
                    !savingMetadata.has(passId) &&
                    !metadataSuccess.has(passId)
                  ) {
                    e.currentTarget.style.backgroundColor = '#2563eb'
                  }
                }}
                onMouseLeave={(e) => {
                  const noteText = noteInputs[passId] || ''
                  const existingNoteText =
                    passNotesData.length > 0 ? passNotesData[0].note_text : ''
                  const noteChanged =
                    noteText.trim() !== existingNoteText.trim()
                  let hasChanges = noteChanged
                  if (!pass.success) {
                    const diagnosisChanged =
                      (passDiagnoses.get(passId)?.symptom || '') !==
                        (diagnosisInputs[passId]?.symptom || '') ||
                      (passDiagnoses.get(passId)?.cause || '') !==
                        (diagnosisInputs[passId]?.cause || '') ||
                      (passDiagnoses.get(passId)?.jira_ticket_url || '') !==
                        (diagnosisInputs[passId]?.jiraTicketUrl || '')
                    hasChanges = noteChanged || diagnosisChanged
                  }
                  if (
                    hasChanges &&
                    !savingMetadata.has(passId) &&
                    !metadataSuccess.has(passId)
                  ) {
                    e.currentTarget.style.backgroundColor = '#3b82f6'
                  }
                }}
              >
                {savingMetadata.has(passId) ? (
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
                    Saving...
                  </>
                ) : metadataSuccess.has(passId) ? (
                  '✓ Saved'
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
