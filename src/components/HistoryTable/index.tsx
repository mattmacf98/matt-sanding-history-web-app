import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  CAUSE_OPTIONS,
  Pass,
  PassDiagnosis,
  PassNote,
  RobotConfigMetadata,
  Step,
  SYMPTOM_OPTIONS,
} from '../../lib/types'
import {
  downloadRobotConfig,
  getPassConfigComparison,
  getRobotConfigAtTime,
} from '../../lib/configUtils'
import { useViamClients } from '../../lib/contexts/ViamClientContext'
import { formatDurationToMinutesSeconds } from '../../lib/videoUtils'
import { getStepVideos } from '../../lib/passUtils'
import * as VIAM from '@viamrobotics/sdk'
import StepVideosGrid from '../StepVideosGrid'
import { getPassMetadataManager } from '../../lib/passMetadataManager'
import { PassFiles } from './PassFiles'
import RenderIf from '../RenderIf'
import { SNAPSHOT_FILE_NAME_PREFIX } from '../../lib/constants'
import Button from '../Button'
import { BinaryDataManager } from '../../lib/BinaryDataManager'
import { BinaryDataFile } from '../../lib/BinaryDataFile'
import { DaySummaryHeader, DayAggregateData } from './DaySummaryHeader'
import { CollapsedRow } from './CollapsedRow'
import { StepImagesGrid } from './StepImagesGrid'
import { PassInfo } from './PassInfo'

interface HistoryTableProps {
  partId: string //TODO: can thes just be grabbed from the viam context?
  machineId: string
  passSummaries?: any[]
  fetchingNotes: boolean
  passNotes: Map<string, PassNote[]> // TODO: notes and diagnosis contexts?
  passDiagnoses: Map<string, PassDiagnosis>
  onNotesUpdate: React.Dispatch<React.SetStateAction<Map<string, PassNote[]>>>
  onDiagnosesUpdate: React.Dispatch<
    React.SetStateAction<Map<string, PassDiagnosis>>
  >
  selectedCamera: string //TODO: context for this
  videoStoreClient: VIAM.GenericComponentClient | null //TODO: context for this
  setBeforeAfterModal: (modal: {
    beforeImage: VIAM.dataApi.BinaryData | null
    afterImage: VIAM.dataApi.BinaryData | null
  }) => void // TODO: context for this
  imageFiles: Map<string, VIAM.dataApi.BinaryData> //TODO: structure files using a binaryDataManger with functions instead of 3 maps
  videoFiles: Map<string, VIAM.dataApi.BinaryData>
  files: Map<string, VIAM.dataApi.BinaryData>
  fetchTimestamp: Date | null
  fetchVideos: (start: Date) => Promise<void>
}

const HistoryTable: React.FC<HistoryTableProps> = ({
  partId,
  machineId,
  passSummaries = [],
  fetchingNotes,
  passNotes,
  passDiagnoses,
  onNotesUpdate,
  onDiagnosesUpdate,
  selectedCamera,
  videoStoreClient,
  setBeforeAfterModal,
  imageFiles,
  videoFiles,
  fetchTimestamp,
  fetchVideos,
  files,
}) => {
  const { viamClient } = useViamClients()

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [fileSearchInputs, setFileSearchInputs] = useState<
    Record<string, string>
  >({})
  const [downloadingConfigs, setDownloadingConfigs] = useState<Set<string>>(
    new Set()
  )
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [configMetadata, setConfigMetadata] = useState<
    Map<string, RobotConfigMetadata>
  >(new Map())
  const [loadingConfigMetadata, setLoadingConfigMetadata] = useState<
    Set<string>
  >(new Set())
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())
  const [diagnosisInputs, setDiagnosisInputs] = useState<
    Record<string, { symptom?: string; cause?: string; jiraTicketUrl?: string }>
  >({})
  const [metadataSuccess, setMetadataSuccess] = useState<Set<string>>(new Set())
  const [savingMetadata, setSavingMetadata] = useState<Set<string>>(new Set())
  const [debouncedFileSearchInputs, setDebouncedFileSearchInputs] = useState<
    Record<string, string>
  >({})
  const [jiraValidationErrors, setJiraValidationErrors] = useState<
    Record<string, string>
  >({})
  const binaryDataManager = useRef<BinaryDataManager>(new BinaryDataManager())

  useEffect(() => {
    binaryDataManager.current = new BinaryDataManager()
    Array.from(files.values()).forEach((file) => {
      binaryDataManager.current?.addBinaryDataFile(new BinaryDataFile(file))
    })
  }, [files])

  // Debounce file search inputs
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFileSearchInputs(fileSearchInputs)
    }, 300) // 300ms delay

    return () => {
      clearTimeout(handler)
    }
  }, [fileSearchInputs])

  // Initialize note inputs from existing notes
  useEffect(() => {
    const initialInputs: Record<string, string> = {}
    passNotes.forEach((notes, passId) => {
      if (notes.length > 0) {
        initialInputs[passId] = notes[0].note_text
      }
    })
    setNoteInputs(initialInputs)
  }, [passNotes])

  // Initialize diagnosis inputs from existing diagnoses
  useEffect(() => {
    const initialDiagnoses: Record<
      string,
      { symptom?: string; cause?: string }
    > = {}
    passDiagnoses.forEach((diagnosis, passId) => {
      initialDiagnoses[passId] = {
        symptom: diagnosis.symptom,
        cause: diagnosis.cause,
      }
    })
    setDiagnosisInputs(initialDiagnoses)
  }, [passDiagnoses])

  const groupedPasses = useMemo(() => {
    return passSummaries.reduce((acc: Record<string, Pass[]>, pass) => {
      // Use a consistent date key (YYYY-MM-DD)
      const dateKey = pass.start.toISOString().split('T')[0]
      if (!acc[dateKey]) {
        acc[dateKey] = []
      }
      acc[dateKey].push(pass)
      return acc
    }, {})
  }, [passSummaries])

  // Memoize day aggregates calculation - calculate both execution percentage AND total time
  const dayAggregates = useMemo(() => {
    return Object.entries(groupedPasses).reduce(
      (acc: Record<string, DayAggregateData>, [dateKey, passes]) => {
        let totalFactoryTime = 0
        let totalExecutionTime = 0
        let totalOtherStepsTime = 0
        let totalBluePoints = 0
        const symptomCounts = new Map<string, number>()
        const causeCounts = new Map<string, number>()

        // Calculate both time and execution metrics
        passes.forEach((pass) => {
          // Add pass duration to total time
          const passDuration = pass.end.getTime() - pass.start.getTime()
          totalFactoryTime += passDuration

          // Calculate execution time for percentage
          if (pass.steps && Array.isArray(pass.steps)) {
            pass.steps.forEach((step) => {
              const stepDuration = step.end.getTime() - step.start.getTime()

              // Look for the specific "executing" step (exact match or case-insensitive)
              if (step.name.toLowerCase() === 'executing') {
                totalExecutionTime += stepDuration
              } else {
                totalOtherStepsTime += stepDuration
              }
            })
          }

          // Sum up blue points
          if (pass.blue_point_count !== undefined) {
            totalBluePoints += pass.blue_point_count
          }

          // Count diagnoses for failed passes
          if (!pass.success) {
            const diagnosis = passDiagnoses.get(pass.pass_id)
            if (diagnosis) {
              if (diagnosis.symptom) {
                symptomCounts.set(
                  diagnosis.symptom,
                  (symptomCounts.get(diagnosis.symptom) || 0) + 1
                )
              }
              if (diagnosis.cause) {
                causeCounts.set(
                  diagnosis.cause,
                  (causeCounts.get(diagnosis.cause) || 0) + 1
                )
              }
            }
          }
        })

        const totalStepsTime = totalExecutionTime + totalOtherStepsTime
        const executionPercentage =
          totalStepsTime > 0 ? (totalExecutionTime / totalStepsTime) * 100 : 0

        // Format the date for display using the dateKey (which is already YYYY-MM-DD)
        const [year, month, day] = dateKey.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        const formattedDate = date.toLocaleDateString([], {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })

        acc[dateKey] = {
          totalFactoryTime,
          totalExecutionTime,
          totalOtherStepsTime,
          totalPassCount: passes.length,
          executionPercentage,
          formattedDate,
          totalBluePoints,
          symptomCounts,
          causeCounts,
        }

        return acc
      },
      {}
    )
  }, [groupedPasses, passDiagnoses])
  // Compute total execution time (ms) for a pass by summing 'executing' steps
  const getExecutionTimeMs = (pass: Pass): number => {
    if (!pass.steps || pass.steps.length === 0) return 0
    return pass.steps.reduce((sum, step) => {
      return step.name.toLowerCase() === 'executing'
        ? sum + (step.end.getTime() - step.start.getTime())
        : sum
    }, 0)
  }

  const handleFileSearchChange = (passId: string, value: string) => {
    setFileSearchInputs((prev) => ({
      ...prev,
      [passId]: value,
    }))
  }

  const toggleFilesExpansion = (passId: string) => {
    const newExpandedFiles = new Set(expandedFiles)
    if (newExpandedFiles.has(passId)) {
      newExpandedFiles.delete(passId)
    } else {
      newExpandedFiles.add(passId)
    }
    setExpandedFiles(newExpandedFiles)
  }

  const handleDownloadConfig = async (pass: Pass) => {
    if (!partId) {
      alert('Unable to download config: missing required information')
      return
    }

    const passId = pass.pass_id

    // Add to downloading state
    setDownloadingConfigs((prev) => new Set(prev).add(passId))

    try {
      // Fetch the config that was active at the pass start time
      const result = await getRobotConfigAtTime(viamClient, partId, pass.start)

      if (!result) {
        alert('No configuration found for this time period')
        return
      }

      // Store metadata for display (if not already stored)
      if (!configMetadata.has(passId)) {
        setConfigMetadata((prev) => new Map(prev).set(passId, result.metadata))
      }

      // Download the config
      downloadRobotConfig(
        result.config,
        passId,
        result.metadata.configTimestamp,
        machineId
      )
    } catch (error) {
      console.error('Error downloading config:', error)
      alert('Failed to download configuration. Please try again.')
    } finally {
      // Remove from downloading state
      setDownloadingConfigs((prev) => {
        const newSet = new Set(prev)
        newSet.delete(passId)
        return newSet
      })
    }
  }

  const toggleRowExpansion = (index: string) => {
    const newExpandedRows = new Set(expandedRows)
    const isExpanding = !newExpandedRows.has(index)

    if (isExpanding) {
      newExpandedRows.add(index)

      // Fetch config metadata when expanding a row
      const [dayIndexStr, passIndexStr] = index.split('-')
      const dayIndex = parseInt(dayIndexStr)
      const passIndex = parseInt(passIndexStr)
      const dateKey = Object.keys(groupedPasses)[dayIndex]
      const pass = groupedPasses[dateKey]?.[passIndex]

      if (
        pass &&
        !configMetadata.has(pass.pass_id) &&
        !loadingConfigMetadata.has(pass.pass_id)
      ) {
        const flatPasses = Object.values(groupedPasses).flat()
        const { prevPass } = getPassConfigComparison(
          pass,
          flatPasses,
          configMetadata
        )
        fetchConfigMetadata(pass, prevPass)
      }
    } else {
      newExpandedRows.delete(index)
    }
    setExpandedRows(newExpandedRows)
  }

  const fetchConfigMetadata = async (pass: Pass, prevPass: Pass | null) => {
    if (!partId) return

    const passId = pass.pass_id
    const prevPassId = prevPass?.pass_id

    const idsToLoad = [passId]
    if (prevPassId && !configMetadata.has(prevPassId)) {
      idsToLoad.push(prevPassId)
    }

    setLoadingConfigMetadata((prev) => new Set([...prev, ...idsToLoad]))

    try {
      const promises = [getRobotConfigAtTime(viamClient, partId, pass.start)]
      if (prevPass) {
        promises.push(getRobotConfigAtTime(viamClient, partId, prevPass.start))
      }

      const results = await Promise.all(promises)

      const newMetadatas = new Map<string, RobotConfigMetadata>()
      if (results[0]) {
        newMetadatas.set(passId, results[0].metadata)
      }
      if (prevPassId && results[1]) {
        newMetadatas.set(prevPassId, results[1].metadata)
      }

      if (newMetadatas.size > 0) {
        setConfigMetadata((prev) => new Map([...prev, ...newMetadatas]))
      }
    } catch (error) {
      console.error('Error fetching config metadata:', error)
    } finally {
      setLoadingConfigMetadata((prev) => {
        const newSet = new Set(prev)
        idsToLoad.forEach((id) => newSet.delete(id))
        return newSet
      })
    }
  }

  const openBeforeAfterModal = (
    beforeImage: VIAM.dataApi.BinaryData | null,
    afterImage: VIAM.dataApi.BinaryData | null
  ) => {
    setBeforeAfterModal({ beforeImage, afterImage })
  }

  const handleNoteChange = (passId: string, value: string) => {
    setNoteInputs((prev) => ({
      ...prev,
      [passId]: value,
    }))

    // Clear success state when editing
    if (metadataSuccess.has(passId)) {
      const newSuccess = new Set(metadataSuccess)
      newSuccess.delete(passId)
      setMetadataSuccess(newSuccess)
    }
  }

  const savePassMetadata = async (passId: string, isFailedPass: boolean) => {
    if (!passId || !partId) return

    const noteText = noteInputs[passId]?.trim() || ''
    const diagnosisData = diagnosisInputs[passId] || {}
    const { symptom, cause, jiraTicketUrl } = diagnosisData

    // Show saving indicator
    setSavingMetadata((prev) => new Set(prev).add(passId))

    try {
      const metadataManager = getPassMetadataManager(viamClient, machineId)

      // Save note
      await metadataManager.savePassNote(passId, noteText)

      // Save diagnosis only for failed passes
      if (isFailedPass) {
        await metadataManager.savePassDiagnosis(
          passId,
          symptom,
          cause,
          jiraTicketUrl
        )
      }

      // Update notes in state
      const newNote: PassNote = {
        pass_id: passId,
        note_text: noteText,
        created_at: new Date().toISOString(),
        created_by: 'summary-web-app',
      }
      onNotesUpdate((prevNotes) => {
        const newNotesMap = new Map(prevNotes)
        newNotesMap.set(passId, [newNote])
        return newNotesMap
      })

      // Update diagnoses in state (only for failed passes)
      if (isFailedPass) {
        onDiagnosesUpdate((prevDiagnoses) => {
          const newDiagnosesMap = new Map(prevDiagnoses)
          if (symptom || cause || jiraTicketUrl) {
            newDiagnosesMap.set(passId, {
              pass_id: passId,
              symptom: symptom as PassDiagnosis['symptom'],
              cause: cause as PassDiagnosis['cause'],
              jira_ticket_url: jiraTicketUrl,
              updated_at: new Date().toISOString(),
              updated_by: 'summary-web-app',
            })
          } else {
            newDiagnosesMap.delete(passId)
          }
          return newDiagnosesMap
        })
      }

      // Show success state
      setMetadataSuccess((prev) => new Set(prev).add(passId))

      // Clear success state after a delay
      setTimeout(() => {
        setMetadataSuccess((prev) => {
          const newSuccess = new Set(prev)
          newSuccess.delete(passId)
          return newSuccess
        })
      }, 2000)
    } catch (error) {
      console.error('Failed to save pass metadata:', error)
    } finally {
      setSavingMetadata((prev) => {
        const newSaving = new Set(prev)
        newSaving.delete(passId)
        return newSaving
      })
    }
  }

  const handleDiagnosisChange = (
    passId: string,
    field: 'symptom' | 'cause' | 'jiraTicketUrl',
    value: string
  ) => {
    setDiagnosisInputs((prev) => ({
      ...prev,
      [passId]: {
        ...prev[passId],
        [field]: value || undefined,
      },
    }))

    // Validate JIRA URL format
    if (field === 'jiraTicketUrl') {
      const trimmedValue = value.trim()
      if (trimmedValue === '') {
        // Empty is valid (field is optional)
        setJiraValidationErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors[passId]
          return newErrors
        })
      } else {
        // Validate URL format
        try {
          const url = new URL(trimmedValue)
          // Check if it's a Viam JIRA URL
          if (url.hostname !== 'viam.atlassian.net') {
            setJiraValidationErrors((prev) => ({
              ...prev,
              [passId]: 'JIRA URL must be from viam.atlassian.net',
            }))
          } else if (!url.pathname.startsWith('/browse/')) {
            setJiraValidationErrors((prev) => ({
              ...prev,
              [passId]:
                'JIRA URL must follow format: https://viam.atlassian.net/browse/PROJECT-123',
            }))
          } else {
            // Valid JIRA URL
            setJiraValidationErrors((prev) => {
              const newErrors = { ...prev }
              delete newErrors[passId]
              return newErrors
            })
          }
        } catch {
          setJiraValidationErrors((prev) => ({
            ...prev,
            [passId]: 'Please enter a valid URL',
          }))
        }
      }
    }

    // Clear success state when editing
    if (metadataSuccess.has(passId)) {
      const newSuccess = new Set(metadataSuccess)
      newSuccess.delete(passId)
      setMetadataSuccess(newSuccess)
    }
  }

  // TODO: split mega table component into smaller components (aggregation, row item, expanded row - (step grid, diagnosis section, files section))
  return (
    <div className="viam-table-container">
      <table className="viam-table">
        <thead>
          <tr>
            <th style={{ width: '20px' }}></th>
            <th>Day</th>
            <th>Pass ID</th>
            <th>Status</th>
            <th>Start time</th>
            <th>End time</th>
            <th>Total duration</th>
            <th>Execution time</th>
            <th>Blue points</th>
            <th>Steps</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedPasses).map(([dateKey, passes], dayIndex) => {
            return (
              <React.Fragment key={dateKey}>
                <DaySummaryHeader data={dayAggregates[dateKey]} />
                {passes.map((pass: Pass, passIndex: number) => {
                  const globalIndex = `${dayIndex}-${passIndex}`
                  const passId = pass.pass_id
                  const passNotesData = passNotes.get(passId) || []
                  const execMs = getExecutionTimeMs(pass)

                  return (
                    <React.Fragment key={pass.pass_id || globalIndex}>
                      <CollapsedRow
                        passId={passId}
                        globalIndex={globalIndex}
                        execMs={execMs}
                        toggleRowExpansion={toggleRowExpansion}
                        expandedRows={expandedRows}
                        passNotesData={passNotesData}
                        passDiagnoses={passDiagnoses}
                        pass={pass}
                        expandedErrors={expandedErrors}
                        setExpandedErrors={setExpandedErrors}
                      />
                      {expandedRows.has(globalIndex) && (
                        <tr className="expanded-content">
                          <td colSpan={11}>
                            <div className="pass-details">
                              {/* Build information section moved inside expanded row */}
                              <RenderIf
                                condition={pass.build_info !== undefined}
                              >
                                <PassInfo
                                  pass={pass}
                                  groupedPasses={groupedPasses}
                                  loadingConfigMetadata={loadingConfigMetadata}
                                  configMetadata={configMetadata}
                                  fetchConfigMetadata={fetchConfigMetadata}
                                  downloadingConfigs={downloadingConfigs}
                                  handleDownloadConfig={handleDownloadConfig}
                                />
                              </RenderIf>

                              <div className="passes-container">
                                <div className="steps-grid">
                                  {/* Camera Images */}
                                  <RenderIf condition={selectedCamera !== ''}>
                                    <StepImagesGrid
                                      pass={pass}
                                      imageFiles={imageFiles}
                                      selectedCamera={selectedCamera}
                                      openBeforeAfterModal={
                                        openBeforeAfterModal
                                      }
                                    />
                                  </RenderIf>

                                  {/* Regular step cards */}
                                  {pass.steps.map((step: Step) => {
                                    const stepVideos = getStepVideos(
                                      step,
                                      videoFiles
                                    )

                                    return (
                                      <div
                                        key={step.name}
                                        className="step-card"
                                      >
                                        <div className="step-name">
                                          {step.name}
                                        </div>
                                        <div className="step-timeline">
                                          <div className="step-time">
                                            <span className="time-label">
                                              Start
                                            </span>
                                            <span className="time-value">
                                              {step.start.toLocaleTimeString()}
                                            </span>
                                          </div>
                                          <div className="timeline-arrow">
                                            →
                                          </div>
                                          <div className="step-time">
                                            <span className="time-label">
                                              End
                                            </span>
                                            <span className="time-value">
                                              {step.end.toLocaleTimeString()}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="step-duration">
                                          {formatDurationToMinutesSeconds(
                                            step.start,
                                            step.end
                                          )}
                                        </div>

                                        <StepVideosGrid
                                          step={step}
                                          stepVideos={stepVideos}
                                          videoFiles={videoFiles}
                                          fetchTimestamp={fetchTimestamp}
                                          videoStoreClient={videoStoreClient}
                                          fetchVideos={fetchVideos}
                                        />
                                      </div>
                                    )
                                  })}

                                  {/* View snapshot card */}
                                  <RenderIf
                                    condition={
                                      binaryDataManager.current.searchBinaryDataByFileName(
                                        SNAPSHOT_FILE_NAME_PREFIX
                                      ).length > 0
                                    }
                                  >
                                    <div className="step-card">
                                      <div className="step-name">
                                        View Snapshot
                                      </div>
                                      <p>
                                        Load and display a 3D scene from a
                                        snapshot file.
                                      </p>
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

                                {/* Diagnosis and Notes Section - shows for all passes, diagnosis fields only for failed */}
                                <div style={{ margin: '1rem 12px 24px 12px' }}>
                                  <div
                                    className="step-card"
                                    style={{
                                      minWidth: '50%',
                                      backgroundColor: 'transparent',
                                    }}
                                  >
                                    <div
                                      className="step-name"
                                      style={{ textAlign: 'left' }}
                                    >
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
                                            border:
                                              '2px solid rgba(59, 130, 246, 0.2)',
                                            borderTopColor: '#3b82f6',
                                            borderRadius: '50%',
                                            animation:
                                              'spin 1s linear infinite',
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
                                                value={
                                                  diagnosisInputs[passId]
                                                    ?.symptom || ''
                                                }
                                                onChange={(e) =>
                                                  handleDiagnosisChange(
                                                    passId,
                                                    'symptom',
                                                    e.target.value
                                                  )
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
                                                <option value="">
                                                  Select symptom...
                                                </option>
                                                {SYMPTOM_OPTIONS.map(
                                                  (option: string) => (
                                                    <option
                                                      key={option}
                                                      value={option}
                                                    >
                                                      {option}
                                                    </option>
                                                  )
                                                )}
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
                                                value={
                                                  diagnosisInputs[passId]
                                                    ?.cause || ''
                                                }
                                                onChange={(e) =>
                                                  handleDiagnosisChange(
                                                    passId,
                                                    'cause',
                                                    e.target.value
                                                  )
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
                                                <option value="">
                                                  Select cause...
                                                </option>
                                                {CAUSE_OPTIONS.map(
                                                  (option: string) => (
                                                    <option
                                                      key={option}
                                                      value={option}
                                                    >
                                                      {option}
                                                    </option>
                                                  )
                                                )}
                                              </select>
                                            </div>
                                          </div>
                                        )}

                                        {/* JIRA Ticket URL - only for failed passes when cause is selected */}
                                        {!pass.success &&
                                          diagnosisInputs[passId]?.cause && (
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
                                                JIRA Ticket (e.g.
                                                https://viam.atlassian.net/browse/RSDK-1234)
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
                                                  value={
                                                    diagnosisInputs[passId]
                                                      ?.jiraTicketUrl || ''
                                                  }
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
                                                {diagnosisInputs[passId]
                                                  ?.jiraTicketUrl &&
                                                  !jiraValidationErrors[
                                                    passId
                                                  ] && (
                                                    <a
                                                      href={
                                                        diagnosisInputs[passId]
                                                          .jiraTicketUrl
                                                      }
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      style={{
                                                        padding: '10px 12px',
                                                        fontSize: '14px',
                                                        color: '#3b82f6',
                                                        textDecoration: 'none',
                                                        border:
                                                          '1px solid #d1d5db',
                                                        borderRadius: '6px',
                                                        backgroundColor:
                                                          '#ffffff',
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
                                            onChange={(e) =>
                                              handleNoteChange(
                                                passId,
                                                e.target.value
                                              )
                                            }
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
                                            onClick={() =>
                                              savePassMetadata(
                                                passId,
                                                !pass.success
                                              )
                                            }
                                            disabled={(() => {
                                              if (
                                                savingMetadata.has(passId) ||
                                                metadataSuccess.has(passId)
                                              )
                                                return true
                                              // Disable if there are JIRA validation errors
                                              if (jiraValidationErrors[passId])
                                                return true
                                              const noteText =
                                                noteInputs[passId] || ''
                                              const existingNoteText =
                                                passNotesData.length > 0
                                                  ? passNotesData[0].note_text
                                                  : ''
                                              const noteChanged =
                                                noteText.trim() !==
                                                existingNoteText.trim()
                                              if (!pass.success) {
                                                const diagnosisChanged =
                                                  (passDiagnoses.get(passId)
                                                    ?.symptom || '') !==
                                                    (diagnosisInputs[passId]
                                                      ?.symptom || '') ||
                                                  (passDiagnoses.get(passId)
                                                    ?.cause || '') !==
                                                    (diagnosisInputs[passId]
                                                      ?.cause || '') ||
                                                  (passDiagnoses.get(passId)
                                                    ?.jira_ticket_url || '') !==
                                                    (diagnosisInputs[passId]
                                                      ?.jiraTicketUrl || '')
                                                return (
                                                  !noteChanged &&
                                                  !diagnosisChanged
                                                )
                                              }
                                              return !noteChanged
                                            })()}
                                            style={{
                                              padding: '6px 8px',
                                              fontSize: '12px',
                                              color: 'white',
                                              backgroundColor:
                                                metadataSuccess.has(passId)
                                                  ? '#10b981'
                                                  : (() => {
                                                      if (
                                                        savingMetadata.has(
                                                          passId
                                                        )
                                                      )
                                                        return '#9ca3af'
                                                      const noteText =
                                                        noteInputs[passId] || ''
                                                      const existingNoteText =
                                                        passNotesData.length > 0
                                                          ? passNotesData[0]
                                                              .note_text
                                                          : ''
                                                      const noteChanged =
                                                        noteText.trim() !==
                                                        existingNoteText.trim()
                                                      if (!pass.success) {
                                                        const diagnosisChanged =
                                                          (passDiagnoses.get(
                                                            passId
                                                          )?.symptom || '') !==
                                                            (diagnosisInputs[
                                                              passId
                                                            ]?.symptom || '') ||
                                                          (passDiagnoses.get(
                                                            passId
                                                          )?.cause || '') !==
                                                            (diagnosisInputs[
                                                              passId
                                                            ]?.cause || '') ||
                                                          (passDiagnoses.get(
                                                            passId
                                                          )?.jira_ticket_url ||
                                                            '') !==
                                                            (diagnosisInputs[
                                                              passId
                                                            ]?.jiraTicketUrl ||
                                                              '')
                                                        return noteChanged ||
                                                          diagnosisChanged
                                                          ? '#3b82f6'
                                                          : '#9ca3af'
                                                      }
                                                      return noteChanged
                                                        ? '#3b82f6'
                                                        : '#9ca3af'
                                                    })(),
                                              border: 'none',
                                              borderRadius: '4px',
                                              cursor: (() => {
                                                if (
                                                  savingMetadata.has(passId) ||
                                                  metadataSuccess.has(passId)
                                                )
                                                  return 'not-allowed'
                                                const noteText =
                                                  noteInputs[passId] || ''
                                                const existingNoteText =
                                                  passNotesData.length > 0
                                                    ? passNotesData[0].note_text
                                                    : ''
                                                const noteChanged =
                                                  noteText.trim() !==
                                                  existingNoteText.trim()
                                                if (!pass.success) {
                                                  const diagnosisChanged =
                                                    (passDiagnoses.get(passId)
                                                      ?.symptom || '') !==
                                                      (diagnosisInputs[passId]
                                                        ?.symptom || '') ||
                                                    (passDiagnoses.get(passId)
                                                      ?.cause || '') !==
                                                      (diagnosisInputs[passId]
                                                        ?.cause || '') ||
                                                    (passDiagnoses.get(passId)
                                                      ?.jira_ticket_url ||
                                                      '') !==
                                                      (diagnosisInputs[passId]
                                                        ?.jiraTicketUrl || '')
                                                  return noteChanged ||
                                                    diagnosisChanged
                                                    ? 'pointer'
                                                    : 'not-allowed'
                                                }
                                                return noteChanged
                                                  ? 'pointer'
                                                  : 'not-allowed'
                                              })(),
                                              transition:
                                                'background-color 0.2s',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '6px',
                                            }}
                                            onMouseEnter={(e) => {
                                              const noteText =
                                                noteInputs[passId] || ''
                                              const existingNoteText =
                                                passNotesData.length > 0
                                                  ? passNotesData[0].note_text
                                                  : ''
                                              const noteChanged =
                                                noteText.trim() !==
                                                existingNoteText.trim()
                                              let hasChanges = noteChanged
                                              if (!pass.success) {
                                                const diagnosisChanged =
                                                  (passDiagnoses.get(passId)
                                                    ?.symptom || '') !==
                                                    (diagnosisInputs[passId]
                                                      ?.symptom || '') ||
                                                  (passDiagnoses.get(passId)
                                                    ?.cause || '') !==
                                                    (diagnosisInputs[passId]
                                                      ?.cause || '') ||
                                                  (passDiagnoses.get(passId)
                                                    ?.jira_ticket_url || '') !==
                                                    (diagnosisInputs[passId]
                                                      ?.jiraTicketUrl || '')
                                                hasChanges =
                                                  noteChanged ||
                                                  diagnosisChanged
                                              }
                                              if (
                                                hasChanges &&
                                                !savingMetadata.has(passId) &&
                                                !metadataSuccess.has(passId)
                                              ) {
                                                e.currentTarget.style.backgroundColor =
                                                  '#2563eb'
                                              }
                                            }}
                                            onMouseLeave={(e) => {
                                              const noteText =
                                                noteInputs[passId] || ''
                                              const existingNoteText =
                                                passNotesData.length > 0
                                                  ? passNotesData[0].note_text
                                                  : ''
                                              const noteChanged =
                                                noteText.trim() !==
                                                existingNoteText.trim()
                                              let hasChanges = noteChanged
                                              if (!pass.success) {
                                                const diagnosisChanged =
                                                  (passDiagnoses.get(passId)
                                                    ?.symptom || '') !==
                                                    (diagnosisInputs[passId]
                                                      ?.symptom || '') ||
                                                  (passDiagnoses.get(passId)
                                                    ?.cause || '') !==
                                                    (diagnosisInputs[passId]
                                                      ?.cause || '') ||
                                                  (passDiagnoses.get(passId)
                                                    ?.jira_ticket_url || '') !==
                                                    (diagnosisInputs[passId]
                                                      ?.jiraTicketUrl || '')
                                                hasChanges =
                                                  noteChanged ||
                                                  diagnosisChanged
                                              }
                                              if (
                                                hasChanges &&
                                                !savingMetadata.has(passId) &&
                                                !metadataSuccess.has(passId)
                                              ) {
                                                e.currentTarget.style.backgroundColor =
                                                  '#3b82f6'
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
                                                    borderTop:
                                                      '2px solid transparent',
                                                    borderRadius: '50%',
                                                    animation:
                                                      'spin 1s linear infinite',
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

                                {/* Parent container for Files and Notes columns */}
                                <div
                                  style={{ display: 'flex', margin: '0 12px' }}
                                >
                                  {/* Column 1: Files captured during this pass */}
                                  <div style={{ flex: '2 1 0%', minWidth: 0 }}>
                                    <PassFiles
                                      pass={pass}
                                      binaryDataManager={
                                        binaryDataManager.current
                                      }
                                      viamClient={viamClient}
                                      fetchTimestamp={fetchTimestamp}
                                      expandedFiles={expandedFiles}
                                      toggleFilesExpansion={
                                        toggleFilesExpansion
                                      }
                                      fileSearchInputs={fileSearchInputs}
                                      handleFileSearchChange={
                                        handleFileSearchChange
                                      }
                                      debouncedFileSearchInputs={
                                        debouncedFileSearchInputs
                                      }
                                      partId={partId}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default HistoryTable
