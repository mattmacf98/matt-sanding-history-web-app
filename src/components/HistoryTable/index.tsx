import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Pass,
  PassDiagnosis,
  PassNote,
  RobotConfigMetadata,
} from '../../lib/types'
import {
  downloadRobotConfig,
  getPassConfigComparison,
  getRobotConfigAtTime,
} from '../../lib/configUtils'
import { useViamClients } from '../../lib/contexts/ViamClientContext'
import * as VIAM from '@viamrobotics/sdk'
import { getPassMetadataManager } from '../../lib/passMetadataManager'
import { PassFiles } from './PassFiles'
import RenderIf from '../RenderIf'
import { BinaryDataManager } from '../../lib/BinaryDataManager'
import { BinaryDataFile } from '../../lib/BinaryDataFile'
import { DaySummaryHeader, DayAggregateData } from './DaySummaryHeader'
import { CollapsedRow } from './CollapsedRow'
import { PassInfo } from './PassInfo'
import { Diagnosis } from './Diagnosis'
import { StepsGrid } from './StepsGrid'

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
  const { viamClient, organizationId } = useViamClients()

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
            <th>Selected zones</th>
            <th>Selected rounds</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedPasses).map(([dateKey, passes], dayIndex) => {
            return (
              <React.Fragment key={dateKey}>
                <DaySummaryHeader data={dayAggregates[dateKey]} colSpan={13} />
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
                                <StepsGrid
                                  pass={pass}
                                  imageFiles={imageFiles}
                                  videoFiles={videoFiles}
                                  selectedCamera={selectedCamera}
                                  fetchTimestamp={fetchTimestamp}
                                  videoStoreClient={videoStoreClient}
                                  binaryDataManager={binaryDataManager.current}
                                  fetchVideos={fetchVideos}
                                  openBeforeAfterModal={openBeforeAfterModal}
                                  machineId={machineId}
                                  organizationId={organizationId}
                                />

                                {/* Diagnosis and Notes Section - shows for all passes, diagnosis fields only for failed */}
                                <Diagnosis
                                  pass={pass}
                                  passId={passId}
                                  fetchingNotes={fetchingNotes}
                                  passNotesData={passNotesData}
                                  passDiagnoses={passDiagnoses}
                                  handleDiagnosisChange={handleDiagnosisChange}
                                  diagnosisInputs={diagnosisInputs}
                                  savingMetadata={savingMetadata}
                                  metadataSuccess={metadataSuccess}
                                  savePassMetadata={savePassMetadata}
                                  noteInputs={noteInputs}
                                  jiraValidationErrors={jiraValidationErrors}
                                  handleNoteChange={handleNoteChange}
                                />

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
