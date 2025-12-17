import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CAUSE_OPTIONS, Pass, PassDiagnosis, PassNote, RobotConfigMetadata, Step, SYMPTOM_OPTIONS } from '../../lib/types';
import { downloadRobotConfig, getPassConfigComparison, getRobotConfigAtTime } from '../../lib/configUtils';
import { useViamClients } from '../../lib/contexts/ViamClientContext';
import { StatusBadge } from '../StatusBadge';
import { formatDurationToMinutesSeconds, formatTimeDifference } from '../../lib/videoUtils';
import { getBeforeAfterImages, getStepVideos } from '../../lib/passUtils';
import * as VIAM from "@viamrobotics/sdk";
import ImageDisplay from '../ImageDisplay';
import StepVideosGrid from '../StepVideosGrid';
import { getPassMetadataManager } from '../../lib/passMetadataManager';
import { PassFiles } from './PassFiles';
import RenderIf from '../RenderIf';
import { SNAPSHOT_FILE_NAME_PREFIX } from '../../lib/constants';
import Button from '../Button';
import { BinaryDataManager } from '../../lib/BinaryDataManager';
import { BinaryDataFile } from '../../lib/BinaryDataFile';
import { DaySummaryHeader, DayAggregateData } from './DaySummaryHeader';

interface HistoryTableProps {
    partId: string; //TODO: can thes just be grabbed from the viam context?
    machineId: string;
    passSummaries?: any[];
    fetchingNotes: boolean;
    passNotes: Map<string, PassNote[]>; // TODO: notes and diagnosis contexts?
    passDiagnoses: Map<string, PassDiagnosis>;
    onNotesUpdate: React.Dispatch<React.SetStateAction<Map<string, PassNote[]>>>;
    onDiagnosesUpdate: React.Dispatch<React.SetStateAction<Map<string, PassDiagnosis>>>;
    selectedCamera: string; //TODO: context for this
    videoStoreClient: VIAM.GenericComponentClient | null; //TODO: context for this
    setBeforeAfterModal: (modal: { beforeImage: VIAM.dataApi.BinaryData | null, afterImage: VIAM.dataApi.BinaryData | null }) => void; // TODO: context for this
    imageFiles: Map<string, VIAM.dataApi.BinaryData>; //TODO: structure files using a binaryDataManger with functions instead of 3 maps
    videoFiles: Map<string, VIAM.dataApi.BinaryData>;
    files: Map<string, VIAM.dataApi.BinaryData>;
    fetchTimestamp: Date | null;
    fetchVideos: (start: Date) => Promise<void>;
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
    const { viamClient } = useViamClients();

    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
    const [fileSearchInputs, setFileSearchInputs] = useState<Record<string, string>>({});
    const [downloadingConfigs, setDownloadingConfigs] = useState<Set<string>>(new Set());
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
    const [configMetadata, setConfigMetadata] = useState<Map<string, RobotConfigMetadata>>(new Map());
    const [loadingConfigMetadata, setLoadingConfigMetadata] = useState<Set<string>>(new Set());
    const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
    const [diagnosisInputs, setDiagnosisInputs] = useState<Record<string, { symptom?: string; cause?: string; jiraTicketUrl?: string }>>({});
    const [metadataSuccess, setMetadataSuccess] = useState<Set<string>>(new Set());
    const [savingMetadata, setSavingMetadata] = useState<Set<string>>(new Set());
    const [debouncedFileSearchInputs, setDebouncedFileSearchInputs] = useState<Record<string, string>>({});
    const [jiraValidationErrors, setJiraValidationErrors] = useState<Record<string, string>>({});
    const binaryDataManager = useRef<BinaryDataManager>(new BinaryDataManager());

    useEffect(() => {
        binaryDataManager.current = new BinaryDataManager();
        Array.from(files.values()).forEach((file) => {
            binaryDataManager.current?.addBinaryDataFile(new BinaryDataFile(file));
        });
    }, [files]);

    // Debounce file search inputs
    useEffect(() => {
      const handler = setTimeout(() => {
      setDebouncedFileSearchInputs(fileSearchInputs);
    }, 300); // 300ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [fileSearchInputs]);

  // Initialize note inputs from existing notes
  useEffect(() => {
    const initialInputs: Record<string, string> = {};
    passNotes.forEach((notes, passId) => {
      if (notes.length > 0) {
        initialInputs[passId] = notes[0].note_text;
      }
    });
    setNoteInputs(initialInputs);
  }, [passNotes]);

  // Initialize diagnosis inputs from existing diagnoses
  useEffect(() => {
    const initialDiagnoses: Record<string, { symptom?: string; cause?: string }> = {};
    passDiagnoses.forEach((diagnosis, passId) => {
      initialDiagnoses[passId] = {
        symptom: diagnosis.symptom,
        cause: diagnosis.cause
      };
    });
    setDiagnosisInputs(initialDiagnoses);
  }, [passDiagnoses]);


    const groupedPasses = useMemo(() => {
        return passSummaries.reduce((acc: Record<string, Pass[]>, pass) => {
          // Use a consistent date key (YYYY-MM-DD)
          const dateKey = pass.start.toISOString().split('T')[0];
          if (!acc[dateKey]) {
            acc[dateKey] = [];
          }
          acc[dateKey].push(pass);
          return acc;
        }, {});
      }, [passSummaries]);

     // Memoize day aggregates calculation - calculate both execution percentage AND total time
    const dayAggregates = useMemo(() => {
        return Object.entries(groupedPasses).reduce((acc: Record<string, DayAggregateData>, [dateKey, passes]) => {
        let totalFactoryTime = 0;
        let totalExecutionTime = 0;
        let totalOtherStepsTime = 0;
        let totalBluePoints = 0;
        const symptomCounts = new Map<string, number>();
        const causeCounts = new Map<string, number>();

        // Calculate both time and execution metrics
        passes.forEach(pass => {
            // Add pass duration to total time
            const passDuration = pass.end.getTime() - pass.start.getTime();
            totalFactoryTime += passDuration;

            // Calculate execution time for percentage
            if (pass.steps && Array.isArray(pass.steps)) {
            pass.steps.forEach(step => {
                const stepDuration = step.end.getTime() - step.start.getTime();

                // Look for the specific "executing" step (exact match or case-insensitive)
                if (step.name.toLowerCase() === 'executing') {
                totalExecutionTime += stepDuration;
                } else {
                totalOtherStepsTime += stepDuration;
                }
            });
            }

            // Sum up blue points
            if (pass.blue_point_count !== undefined) {
            totalBluePoints += pass.blue_point_count;
            }

            // Count diagnoses for failed passes
            if (!pass.success) {
              const diagnosis = passDiagnoses.get(pass.pass_id);
              if (diagnosis) {
                if (diagnosis.symptom) {
                  symptomCounts.set(diagnosis.symptom, (symptomCounts.get(diagnosis.symptom) || 0) + 1);
                }
                if (diagnosis.cause) {
                  causeCounts.set(diagnosis.cause, (causeCounts.get(diagnosis.cause) || 0) + 1);
                }
              }
            }
        });

        const totalStepsTime = totalExecutionTime + totalOtherStepsTime;
        const executionPercentage = totalStepsTime > 0 ? (totalExecutionTime / totalStepsTime) * 100 : 0;

        // Format the date for display using the dateKey (which is already YYYY-MM-DD)
        const [year, month, day] = dateKey.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const formattedDate = date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });

        acc[dateKey] = {
            totalFactoryTime,
            totalExecutionTime,
            totalOtherStepsTime,
            totalPassCount: passes.length,
            executionPercentage,
            formattedDate,
            totalBluePoints,
            symptomCounts,
            causeCounts
        };

        return acc;
        }, {});
    }, [groupedPasses, passDiagnoses]);
    // Compute total execution time (ms) for a pass by summing 'executing' steps
    const getExecutionTimeMs = (pass: Pass): number => {
        if (!pass.steps || pass.steps.length === 0) return 0;
        return pass.steps.reduce((sum, step) => {
        return step.name.toLowerCase() === 'executing'
            ? sum + (step.end.getTime() - step.start.getTime())
            : sum;
        }, 0);
    };

    const handleFileSearchChange = (passId: string, value: string) => {
        setFileSearchInputs(prev => ({
        ...prev,
        [passId]: value
        }));
    };

    const toggleFilesExpansion = (passId: string) => {
        const newExpandedFiles = new Set(expandedFiles);
        if (newExpandedFiles.has(passId)) {
        newExpandedFiles.delete(passId);
        } else {
        newExpandedFiles.add(passId);
        }
        setExpandedFiles(newExpandedFiles);
    };

    const handleDownloadConfig = async (pass: Pass) => {
    if (!partId) {
      alert('Unable to download config: missing required information');
      return;
    }

    const passId = pass.pass_id;
    
    // Add to downloading state
    setDownloadingConfigs(prev => new Set(prev).add(passId));

    try {
      // Fetch the config that was active at the pass start time
      const result = await getRobotConfigAtTime(viamClient, partId, pass.start);
      
      if (!result) {
        alert('No configuration found for this time period');
        return;
      }

      // Store metadata for display (if not already stored)
      if (!configMetadata.has(passId)) {
        setConfigMetadata(prev => new Map(prev).set(passId, result.metadata));
      }

      // Download the config
      downloadRobotConfig(result.config, passId, result.metadata.configTimestamp, machineId);
    } catch (error) {
      console.error('Error downloading config:', error);
      alert('Failed to download configuration. Please try again.');
    } finally {
      // Remove from downloading state
      setDownloadingConfigs(prev => {
        const newSet = new Set(prev);
        newSet.delete(passId);
        return newSet;
      });
    }
  };

    const toggleRowExpansion = (index: string) => {
        const newExpandedRows = new Set(expandedRows);
        const isExpanding = !newExpandedRows.has(index);

        if (isExpanding) {
        newExpandedRows.add(index);
        
        // Fetch config metadata when expanding a row
        const [dayIndexStr, passIndexStr] = index.split('-');
        const dayIndex = parseInt(dayIndexStr);
        const passIndex = parseInt(passIndexStr);
        const dateKey = Object.keys(groupedPasses)[dayIndex];
        const pass = groupedPasses[dateKey]?.[passIndex];
        
        if (pass && !configMetadata.has(pass.pass_id) && !loadingConfigMetadata.has(pass.pass_id)) {
            const flatPasses = Object.values(groupedPasses).flat();
            const { prevPass } = getPassConfigComparison(pass, flatPasses, configMetadata);
            fetchConfigMetadata(pass, prevPass);
        }
        } else {
        newExpandedRows.delete(index);
        }
        setExpandedRows(newExpandedRows);
    };

    const passImages = (pass: Pass) => getBeforeAfterImages(pass, imageFiles, selectedCamera);

    const fetchConfigMetadata = async (pass: Pass, prevPass: Pass | null) => {
        if (!partId) return;

        const passId = pass.pass_id;
        const prevPassId = prevPass?.pass_id;

        const idsToLoad = [passId];
        if (prevPassId && !configMetadata.has(prevPassId)) {
        idsToLoad.push(prevPassId);
        }

        setLoadingConfigMetadata(prev => new Set([...prev, ...idsToLoad]));

        try {
        const promises = [getRobotConfigAtTime(viamClient, partId, pass.start)];
        if (prevPass) {
            promises.push(getRobotConfigAtTime(viamClient, partId, prevPass.start));
        }

        const results = await Promise.all(promises);
        
        const newMetadatas = new Map<string, RobotConfigMetadata>();
        if (results[0]) {
            newMetadatas.set(passId, results[0].metadata);
        }
        if (prevPassId && results[1]) {
            newMetadatas.set(prevPassId, results[1].metadata);
        }

        if (newMetadatas.size > 0) {
            setConfigMetadata(prev => new Map([...prev, ...newMetadatas]));
        }
        } catch (error) {
        console.error('Error fetching config metadata:', error);
        } finally {
        setLoadingConfigMetadata(prev => {
            const newSet = new Set(prev);
            idsToLoad.forEach(id => newSet.delete(id));
            return newSet;
        });
        }
    };

    const openBeforeAfterModal = (beforeImage: VIAM.dataApi.BinaryData | null, afterImage: VIAM.dataApi.BinaryData | null) => {
        setBeforeAfterModal({ beforeImage, afterImage });
    };

    const handleNoteChange = (passId: string, value: string) => {
      setNoteInputs(prev => ({
        ...prev,
        [passId]: value
      }));
  
      // Clear success state when editing
      if (metadataSuccess.has(passId)) {
        const newSuccess = new Set(metadataSuccess);
        newSuccess.delete(passId);
        setMetadataSuccess(newSuccess);
      }
    };

    const savePassMetadata = async (passId: string, isFailedPass: boolean) => {
      if (!passId || !partId) return;
  
      const noteText = noteInputs[passId]?.trim() || '';
      const diagnosisData = diagnosisInputs[passId] || {};
      const { symptom, cause, jiraTicketUrl } = diagnosisData;
  
      // Show saving indicator
      setSavingMetadata(prev => new Set(prev).add(passId));
  
      try {
        const metadataManager = getPassMetadataManager(viamClient, machineId);
        
        // Save note
        await metadataManager.savePassNote(passId, noteText);
        
        // Save diagnosis only for failed passes
        if (isFailedPass) {
          await metadataManager.savePassDiagnosis(passId, symptom, cause, jiraTicketUrl);
        }
  
        // Update notes in state
        const newNote: PassNote = {
          pass_id: passId,
          note_text: noteText,
          created_at: new Date().toISOString(),
          created_by: "summary-web-app"
        };
        onNotesUpdate(prevNotes => {
          const newNotesMap = new Map(prevNotes);
          newNotesMap.set(passId, [newNote]);
          return newNotesMap;
        });
  
        // Update diagnoses in state (only for failed passes)
        if (isFailedPass) {
          onDiagnosesUpdate(prevDiagnoses => {
            const newDiagnosesMap = new Map(prevDiagnoses);
            if (symptom || cause || jiraTicketUrl) {
              newDiagnosesMap.set(passId, {
                pass_id: passId,
                symptom: symptom as PassDiagnosis['symptom'],
                cause: cause as PassDiagnosis['cause'],
                jira_ticket_url: jiraTicketUrl,
                updated_at: new Date().toISOString(),
                updated_by: "summary-web-app"
              });
            } else {
              newDiagnosesMap.delete(passId);
            }
            return newDiagnosesMap;
          });
        }
  
        // Show success state
        setMetadataSuccess(prev => new Set(prev).add(passId));
  
        // Clear success state after a delay
        setTimeout(() => {
          setMetadataSuccess(prev => {
            const newSuccess = new Set(prev);
            newSuccess.delete(passId);
            return newSuccess;
          });
        }, 2000);
      } catch (error) {
        console.error("Failed to save pass metadata:", error);
      } finally {
        setSavingMetadata(prev => {
          const newSaving = new Set(prev);
          newSaving.delete(passId);
          return newSaving;
        });
      }
    };

    const handleDiagnosisChange = (passId: string, field: 'symptom' | 'cause' | 'jiraTicketUrl', value: string) => {
      setDiagnosisInputs(prev => ({
        ...prev,
        [passId]: {
          ...prev[passId],
          [field]: value || undefined
        }
      }));
  
      // Validate JIRA URL format
      if (field === 'jiraTicketUrl') {
        const trimmedValue = value.trim();
        if (trimmedValue === '') {
          // Empty is valid (field is optional)
          setJiraValidationErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[passId];
            return newErrors;
          });
        } else {
          // Validate URL format
          try {
            const url = new URL(trimmedValue);
            // Check if it's a Viam JIRA URL
            if (url.hostname !== 'viam.atlassian.net') {
              setJiraValidationErrors(prev => ({
                ...prev,
                [passId]: 'JIRA URL must be from viam.atlassian.net'
              }));
            } else if (!url.pathname.startsWith('/browse/')) {
              setJiraValidationErrors(prev => ({
                ...prev,
                [passId]: 'JIRA URL must follow format: https://viam.atlassian.net/browse/PROJECT-123'
              }));
            } else {
              // Valid JIRA URL
              setJiraValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[passId];
                return newErrors;
              });
            }
          } catch {
            setJiraValidationErrors(prev => ({
              ...prev,
              [passId]: 'Please enter a valid URL'
            }));
          }
        }
      }
  
      // Clear success state when editing
      if (metadataSuccess.has(passId)) {
        const newSuccess = new Set(metadataSuccess);
        newSuccess.delete(passId);
        setMetadataSuccess(newSuccess);
      }
    };

  
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
                          const globalIndex = `${dayIndex}-${passIndex}`;
                          const passId = pass.pass_id;
                          const passNotesData = passNotes.get(passId) || [];
                          const execMs = getExecutionTimeMs(pass);

                          return (
                            <React.Fragment key={pass.pass_id || globalIndex}>
                              <tr className="expandable-row"
                                onClick={() => toggleRowExpansion(globalIndex)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleRowExpansion(globalIndex);
                                  }
                                }}
                                aria-expanded={expandedRows.has(globalIndex)}
                                aria-label={`${expandedRows.has(globalIndex) ? 'Collapse' : 'Expand'} details for pass from ${pass.start.toLocaleTimeString()}`}>
                                <td>
                                  <span className={`expand-icon ${expandedRows.has(globalIndex) ? 'expanded' : ''}`} aria-hidden="true">
                                    ▶
                                  </span>
                                </td>
                                <td className="text-zinc-700">{pass.start.toLocaleDateString()}</td>
                                <td className="text-zinc-700 text-xs">
                                  {pass.pass_id ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(pass.pass_id);
                                          // Show copied feedback
                                          const btn = e.currentTarget;
                                          const svg = btn.querySelector('svg');
                                          const textSpan = btn.querySelector('span');
                                          // Change to green success state
                                          btn.style.backgroundColor = '#dcfce7';
                                          btn.style.color = '#166534';
                                          if (svg) {
                                            svg.innerHTML = '<path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />';
                                            svg.style.fill = '#166534';
                                          }
                                          if (textSpan) {
                                            textSpan.style.color = '#166534';
                                          }
                                          setTimeout(() => {
                                            btn.style.backgroundColor = '#f3f4f6';
                                            btn.style.color = '';
                                            if (svg) {
                                              svg.innerHTML = '<path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />';
                                              svg.style.fill = '#9ca3af';
                                            }
                                            if (textSpan) {
                                              textSpan.style.color = '#52525b';
                                            }
                                          }, 1500);
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
                                          cursor: 'pointer'
                                        }}
                                        onMouseEnter={(e) => {
                                          const btn = e.currentTarget;
                                          const svg = btn.querySelector('svg');
                                          const textSpan = btn.querySelector('span');
                                          if (btn.style.backgroundColor !== 'rgb(220, 252, 231)') { // not in success state
                                            btn.style.backgroundColor = '#dbeafe';
                                            if (svg) svg.style.fill = '#2563eb';
                                            if (textSpan) textSpan.style.color = '#2563eb';
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          const btn = e.currentTarget;
                                          const svg = btn.querySelector('svg');
                                          const textSpan = btn.querySelector('span');
                                          if (btn.style.backgroundColor !== 'rgb(220, 252, 231)') { // not in success state
                                            btn.style.backgroundColor = '#f3f4f6';
                                            if (svg) svg.style.fill = '#9ca3af';
                                            if (textSpan) textSpan.style.color = '#52525b';
                                          }
                                        }}
                                      >
                                        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace', color: '#52525b', fontSize: '11px' }}>{pass.pass_id.substring(0, 8)}</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style={{ width: '12px', height: '12px', fill: '#9ca3af', transition: 'fill 0.15s ease' }}>
                                          <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
                                        </svg>
                                      </button>
                                      {(() => {
                                        const hasNotes = passNotesData.length > 0 && passNotesData[0].note_text.trim();
                                        const diagnosisData = passDiagnoses.get(passId);
                                        const hasDiagnosis = diagnosisData && (diagnosisData.symptom || diagnosisData.cause);
                                        
                                        if (hasNotes || hasDiagnosis) {
                                          return (
                                            <span
                                              style={{
                                                fontSize: '18px',
                                                display: 'flex',
                                                alignItems: 'center'
                                              }}
                                              title={hasNotes && hasDiagnosis ? "This pass has notes and diagnosis" : hasNotes ? "This pass has notes" : "This pass has diagnosis"}
                                            >
                                              📝
                                            </span>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td><StatusBadge success={pass.success} /></td>
                                <td className="text-zinc-700">{pass.start.toLocaleTimeString()}</td>
                                <td className="text-zinc-700">{pass.end.toLocaleTimeString()}</td>
                                <td className="text-zinc-700">{formatDurationToMinutesSeconds(pass.start, pass.end)}</td>
                                <td className="text-zinc-700">
                                  {formatDurationToMinutesSeconds(new Date(0), new Date(execMs))}
                                </td>
                                <td className="text-zinc-700">
                                  {pass.blue_point_count !== undefined ? pass.blue_point_count.toLocaleString() : '—'}
                                </td>
                                <td className="text-zinc-700">
                                  {pass.steps ? `${pass.steps.length} steps` : '—'}
                                </td>
                                <td className="text-zinc-700">
                                  {pass.err_string ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                                      <span 
                                        className="text-red-600 text-xxs font-mono error-text" 
                                        title={pass.err_string}
                                        style={{
                                          display: 'block',
                                          maxWidth: '100%',
                                          wordBreak: 'break-word',
                                          whiteSpace: 'pre-wrap'
                                        }}
                                      >
                                        {expandedErrors.has(pass.pass_id) 
                                          ? pass.err_string 
                                          : pass.err_string.length > 150 
                                            ? `${pass.err_string.substring(0, 150)}...` 
                                            : pass.err_string
                                        }
                                      </span>
                                      {pass.err_string.length > 150 && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedErrors(prev => {
                                              const newSet = new Set(prev);
                                              if (newSet.has(pass.pass_id)) {
                                                newSet.delete(pass.pass_id);
                                              } else {
                                                newSet.add(pass.pass_id);
                                              }
                                              return newSet;
                                            });
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
                                            fontWeight: 'bold'
                                          }}
                                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#db5353ff'; e.currentTarget.style.color = '#fff'; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#eee'; e.currentTarget.style.color = '#db5353ff'; }}
                                        >
                                          {expandedErrors.has(pass.pass_id) ? 'Show less' : 'Show more'}
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-600">—</span>
                                  )}
                                </td>
                              </tr>{expandedRows.has(globalIndex) && (
                                <tr className="expanded-content">
                                  <td colSpan={11}>
                                    <div className="pass-details">
                                      {/* Build information section moved inside expanded row */}
                                      {pass.build_info && (
                                        <div className="flex gap-8">
                                          <div className="info-section">
                                            <div style={{ 
                                              display: 'flex', 
                                              alignItems: 'center',
                                              marginBottom: '12px'
                                            }}>
                                              <h4 style={{ margin: 0 }}>Blue points</h4>
                                            </div>
                                            <div className="info-grid">
                                              {pass.blue_point_count !== undefined && (
                                                <div className="info-item">
                                                  <span className="info-label">
                                                    Blue Points
                                                    {pass.blue_point_diff_percent !== undefined && (
                                                      <span style={{ 
                                                        marginLeft: '8px', 
                                                        fontSize: '12px',
                                                        color: '#6b7280',
                                                        fontWeight: '500'
                                                      }}>
                                                        ({pass.blue_point_diff_percent > 0 ? '+' : ''}{pass.blue_point_diff_percent.toFixed(1)}%)
                                                      </span>
                                                    )}
                                                  </span>
                                                  <span className="info-value">
                                                    {pass.blue_point_count.toLocaleString()}
                                                  </span>
                                                </div>
                                              )}
                                              
                                              {pass.sanding_distance_mm !== undefined && (
                                                <div className="info-item">
                                                  <span className="info-label">Sanding Distance</span>
                                                  <span className="info-value">
                                                    {pass.sanding_distance_mm >= 1000 
                                                      ? `${(pass.sanding_distance_mm / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m`
                                                      : `${pass.sanding_distance_mm.toFixed(1)} mm`
                                                    }
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          <div className="info-section">
                                            <div style={{ 
                                              display: 'flex', 
                                              alignItems: 'center',
                                              marginBottom: '12px'
                                            }}>
                                              <h4 style={{ margin: 0 }}>Build information</h4>
                                            </div>

                                            {(pass.build_info.version || pass.build_info.git_revision || pass.build_info.date_compiled) ? (
                                              <div className="info-grid">
                                                {/* Version */}
                                                {pass.build_info.version && (
                                                  <div className="info-item">
                                                    <span className="info-label">Version</span>
                                                    <span className="info-value">{pass.build_info.version}</span>
                                                  </div>
                                                )}

                                                {/* Git Revision */}
                                                {pass.build_info.git_revision && (
                                                  <div className="info-item">
                                                    <span className="info-label">Git revision</span>
                                                    <span className="info-value">{pass.build_info.git_revision}</span>
                                                  </div>
                                                )}

                                                {/* Date Compiled */}
                                                {pass.build_info.date_compiled && (
                                                  <div className="info-item">
                                                    <span className="info-label">Date compiled</span>
                                                    <span className="info-value">{pass.build_info.date_compiled}</span>
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
                                            <div style={{ 
                                              display: 'flex', 
                                              alignItems: 'center',
                                              marginBottom: '12px'
                                            }}>
                                              <h4 style={{ margin: 0 }}>Config information</h4>
                                              {(() => {
                                                const flatPasses = Object.values(groupedPasses).flat();
                                                const { prevPass, configChanged } = getPassConfigComparison(pass, flatPasses, configMetadata);

                                                // If the previous pass exists but we don't have its metadata yet,
                                                // trigger a fetch. The UI will update on the next render cycle.
                                                if (prevPass && !configMetadata.has(prevPass.pass_id) && !loadingConfigMetadata.has(prevPass.pass_id)) {
                                                  fetchConfigMetadata(pass, prevPass);
                                                }

                                                // Only show the badge if the metadata for both passes has been loaded and they are different.
                                                if (configChanged) {
                                                  return (
                                                    <div style={{
                                                      marginLeft: '12px',
                                                      fontSize: '12px',
                                                      color: '#4f46e5',
                                                      backgroundColor: '#eef2ff',
                                                      padding: '2px 8px',
                                                      borderRadius: '9999px',
                                                      fontWeight: 500,
                                                    }}>
                                                      Config changed since last run
                                                    </div>
                                                  );
                                                }
                                                return null;
                                              })()}
                                            </div>
                                            
                                            {loadingConfigMetadata.has(pass.pass_id) ? (
                                              <div style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '8px',
                                                marginBottom: '12px',
                                                color: '#6b7280',
                                                fontSize: '14px'
                                              }}>
                                                <div style={{
                                                  width: '16px',
                                                  height: '16px',
                                                  border: '2px solid rgba(59, 130, 246, 0.2)',
                                                  borderTop: '2px solid #3b82f6',
                                                  borderRadius: '50%',
                                                  animation: 'spin 1s linear infinite'
                                                }} />
                                                Loading config info...
                                              </div>
                                            ) : configMetadata.has(pass.pass_id) ? (
                                              <div className="info-grid" style={{ marginBottom: '12px' }}>
                                                {(() => {
                                                  const metadata = configMetadata.get(pass.pass_id)!;
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
                                                            backgroundColor: downloadingConfigs.has(pass.pass_id) ? '#9ca3af' : '#3b82f6',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: downloadingConfigs.has(pass.pass_id) ? 'not-allowed' : 'pointer',
                                                            transition: 'background-color 0.2s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                          }}
                                                          onMouseEnter={(e) => {
                                                            if (!downloadingConfigs.has(pass.pass_id)) {
                                                              e.currentTarget.style.backgroundColor = '#2563eb';
                                                            }
                                                          }}
                                                          onMouseLeave={(e) => {
                                                            if (!downloadingConfigs.has(pass.pass_id)) {
                                                              e.currentTarget.style.backgroundColor = '#3b82f6';
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
                                                                  animation: 'spin 1s linear infinite'
                                                                }}
                                                              />
                                                              Downloading...
                                                            </>
                                                          ) : (
                                                            <>
                                                              Download config
                                                            </>
                                                          )}
                                                        </button>
                                                      </div>
                                                      
                                                    </>
                                                  );
                                                })()}
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      )}

                                      <div className="passes-container">
                                        <div className="steps-grid">
                                          {/* Camera Images */}
                                          {selectedCamera && (() => {
                                            const { beforeImage, afterImage } = passImages(pass);
                                            const passStart = pass.start;
                                            const passEnd = pass.end;

                                            // If no images at all, show a message
                                            if (!beforeImage && !afterImage) {
                                              return (
                                                <div className="step-card" style={{ order: 0 }}>
                                                  <div style={{
                                                    display: 'flex',
                                                    height: '100%',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: '#f3f4f6',
                                                    borderRadius: '4px',
                                                    padding: '12px',
                                                    color: '#9ca3af',
                                                    fontSize: '14px'
                                                  }}>
                                                    No images captured during this pass
                                                  </div>
                                                </div>
                                              );
                                            }

                                            return (
                                              <>
                                                {/* Start Image */}
                                                {beforeImage && (
                                                  <div className="step-card" style={{ order: -1 }}>
                                                    <div className="step-name">Start Image</div>
                                                    <div className="step-duration">
                                                      {beforeImage.metadata?.timeRequested?.toDate().toLocaleTimeString()}
                                                      <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                                                        ({formatTimeDifference(
                                                          beforeImage.metadata?.timeRequested?.toDate()?.getTime() || passStart.getTime(),
                                                          passStart.getTime()
                                                        )} from start)
                                                      </span>
                                                    </div>

                                                    <div
                                                      className="step-image-container clickable-image"
                                                      style={{ marginTop: "12px", width: "100%", overflow: "hidden" }}
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
                                                      <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                                                        ({formatTimeDifference(
                                                          passEnd.getTime(),
                                                          afterImage.metadata?.timeRequested?.toDate()?.getTime() || passEnd.getTime()
                                                        )} before end)
                                                      </span>
                                                    </div>

                                                    <div
                                                      className="step-image-container clickable-image"
                                                      style={{ marginTop: "12px", width: "100%", overflow: "hidden" }}
                                                      onClick={() => openBeforeAfterModal(beforeImage, afterImage)}
                                                    >
                                                      <ImageDisplay binaryData={afterImage} />
                                                    </div>
                                                  </div>
                                                )}
                                              </>
                                            );
                                          })()}

                                          {/* Regular step cards */}
                                          {pass.steps.map((step: Step) => {
                                            const stepVideos = getStepVideos(step, videoFiles);

                                            return (
                                              <div key={step.name} className="step-card">
                                                <div className="step-name">{step.name}</div>
                                                <div className="step-timeline">
                                                  <div className="step-time">
                                                    <span className="time-label">Start</span>
                                                    <span className="time-value">{step.start.toLocaleTimeString()}</span>
                                                  </div>
                                                  <div className="timeline-arrow">→</div>
                                                  <div className="step-time">
                                                    <span className="time-label">End</span>
                                                    <span className="time-value">{step.end.toLocaleTimeString()}</span>
                                                  </div>
                                                </div>
                                                <div className="step-duration">{formatDurationToMinutesSeconds(step.start, step.end)}</div>

                                                <StepVideosGrid
                                                  step={step}
                                                  stepVideos={stepVideos}
                                                  videoFiles={videoFiles}
                                                  fetchTimestamp={fetchTimestamp}
                                                  videoStoreClient={videoStoreClient}
                                                  fetchVideos={fetchVideos}
                                                />
                                              </div>
                                            );
                                          })}
                                          <RenderIf condition={binaryDataManager.current.searchBinaryDataByFileName(SNAPSHOT_FILE_NAME_PREFIX).length > 0}>
                                            <div className="step-card">
                                              <div className="step-name">View Snapshot</div>
                                              <p>
                                                Load and display a 3D scene from a snapshot file.
                                                </p>
                                                <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                                                  <Button>
                                                    View
                                                  </Button>
                                                </div>
                                            </div>
                                          </RenderIf>
                                          
                                          
                                        </div>

                                        {/* Diagnosis and Notes Section - shows for all passes, diagnosis fields only for failed */}
                                        <div style={{ margin: '1rem 12px 24px 12px' }}>
                                          <div className="step-card" style={{ minWidth: '50%', backgroundColor: 'transparent' }}>
                                            <div className="step-name" style={{ textAlign: 'left' }}>
                                              {!pass.success ? 'Diagnosis' : 'Notes'}
                                            </div>

                                            {fetchingNotes ? (
                                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
                                                <span style={{
                                                  display: 'inline-block',
                                                  width: '20px',
                                                  height: '20px',
                                                  border: '2px solid rgba(59, 130, 246, 0.2)',
                                                  borderTopColor: '#3b82f6',
                                                  borderRadius: '50%',
                                                  animation: 'spin 1s linear infinite'
                                                }}></span>
                                                <span style={{ marginLeft: '10px', color: '#6b7280', fontSize: '14px' }}>Loading...</span>
                                              </div>
                                            ) : (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {/* Diagnosis dropdowns - only for failed passes, displayed in a row */}
                                                {!pass.success && (
                                                  <div style={{ display: 'flex', gap: '16px' }}>
                                                    <div style={{ flex: 1 }}>
                                                      <label htmlFor={`symptom-${passId}`} style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                                                        Symptom
                                                      </label>
                                                      <select
                                                        id={`symptom-${passId}`}
                                                        value={diagnosisInputs[passId]?.symptom || ''}
                                                        onChange={(e) => handleDiagnosisChange(passId, 'symptom', e.target.value)}
                                                        style={{
                                                          width: '100%',
                                                          padding: '10px 12px',
                                                          fontSize: '14px',
                                                          border: '1px solid #d1d5db',
                                                          borderRadius: '6px',
                                                          backgroundColor: '#ffffff',
                                                          cursor: 'pointer',
                                                          outline: 'none'
                                                        }}
                                                      >
                                                        <option value="">Select symptom...</option>
                                                        {SYMPTOM_OPTIONS.map((option: string) => (
                                                          <option key={option} value={option}>{option}</option>
                                                        ))}
                                                      </select>
                                                    </div>

                                                    <div style={{ flex: 1 }}>
                                                      <label htmlFor={`cause-${passId}`} style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                                                        Cause
                                                      </label>
                                                      <select
                                                        id={`cause-${passId}`}
                                                        value={diagnosisInputs[passId]?.cause || ''}
                                                        onChange={(e) => handleDiagnosisChange(passId, 'cause', e.target.value)}
                                                        style={{
                                                          width: '100%',
                                                          padding: '10px 12px',
                                                          fontSize: '14px',
                                                          border: '1px solid #d1d5db',
                                                          borderRadius: '6px',
                                                          backgroundColor: '#ffffff',
                                                          cursor: 'pointer',
                                                          outline: 'none'
                                                        }}
                                                      >
                                                        <option value="">Select cause...</option>
                                                        {CAUSE_OPTIONS.map((option: string) => (
                                                          <option key={option} value={option}>{option}</option>
                                                        ))}
                                                      </select>
                                                    </div>
                                                  </div>
                                                )}

                                                {/* JIRA Ticket URL - only for failed passes when cause is selected */}
                                                {!pass.success && diagnosisInputs[passId]?.cause && (
                                                  <div>
                                                    <label htmlFor={`jira-${passId}`} style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                                                      JIRA Ticket (e.g. https://viam.atlassian.net/browse/RSDK-1234)
                                                    </label>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                      <input
                                                        id={`jira-${passId}`}
                                                        type="url"
                                                        value={diagnosisInputs[passId]?.jiraTicketUrl || ''}
                                                        onChange={(e) => handleDiagnosisChange(passId, 'jiraTicketUrl', e.target.value)}
                                                        placeholder="https://viam.atlassian.net/browse/RSDK-..."
                                                        style={{
                                                          flex: 1,
                                                          padding: '10px 12px',
                                                          fontSize: '14px',
                                                          border: '1px solid #d1d5db',
                                                          borderRadius: '6px',
                                                          backgroundColor: '#ffffff',
                                                          outline: 'none'
                                                        }}
                                                      />
                                                      {diagnosisInputs[passId]?.jiraTicketUrl && !jiraValidationErrors[passId] && (
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
                                                            alignItems: 'center'
                                                          }}
                                                          title="Open JIRA ticket"
                                                        >
                                                          🔗
                                                        </a>
                                                      )}
                                                    </div>
                                                    {jiraValidationErrors[passId] && (
                                                      <div style={{ 
                                                        fontSize: '12px', 
                                                        color: '#dc2626', 
                                                        marginTop: '4px' 
                                                      }}>
                                                        {jiraValidationErrors[passId]}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}

                                                {/* Notes textarea - always shown */}
                                                <div>
                                                  {/* Only show label when there are diagnosis fields above */}
                                                  {!pass.success && (
                                                    <label htmlFor={`pass-notes-${passId}`} style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
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
                                                      lineHeight: '1.5'
                                                    }}
                                                    aria-label={`Notes for pass ${passId}`}
                                                  />
                                                </div>

                                                {/* Save button - full width at bottom */}
                                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                  <button
                                                    type="button"
                                                    onClick={() => savePassMetadata(passId, !pass.success)}
                                                    disabled={(() => {
                                                      if (savingMetadata.has(passId) || metadataSuccess.has(passId)) return true;
                                                      // Disable if there are JIRA validation errors
                                                      if (jiraValidationErrors[passId]) return true;
                                                      const noteText = noteInputs[passId] || '';
                                                      const existingNoteText = passNotesData.length > 0 ? passNotesData[0].note_text : '';
                                                      const noteChanged = noteText.trim() !== existingNoteText.trim();
                                                      if (!pass.success) {
                                                        const diagnosisChanged = 
                                                          (passDiagnoses.get(passId)?.symptom || '') !== (diagnosisInputs[passId]?.symptom || '') ||
                                                          (passDiagnoses.get(passId)?.cause || '') !== (diagnosisInputs[passId]?.cause || '') ||
                                                          (passDiagnoses.get(passId)?.jira_ticket_url || '') !== (diagnosisInputs[passId]?.jiraTicketUrl || '');
                                                        return !noteChanged && !diagnosisChanged;
                                                      }
                                                      return !noteChanged;
                                                    })()}
                                                    style={{
                                                      padding: '6px 8px',
                                                      fontSize: '12px',
                                                      color: 'white',
                                                      backgroundColor: metadataSuccess.has(passId) ? '#10b981' : (() => {
                                                        if (savingMetadata.has(passId)) return '#9ca3af';
                                                        const noteText = noteInputs[passId] || '';
                                                        const existingNoteText = passNotesData.length > 0 ? passNotesData[0].note_text : '';
                                                        const noteChanged = noteText.trim() !== existingNoteText.trim();
                                                        if (!pass.success) {
                                                          const diagnosisChanged = 
                                                            (passDiagnoses.get(passId)?.symptom || '') !== (diagnosisInputs[passId]?.symptom || '') ||
                                                            (passDiagnoses.get(passId)?.cause || '') !== (diagnosisInputs[passId]?.cause || '') ||
                                                            (passDiagnoses.get(passId)?.jira_ticket_url || '') !== (diagnosisInputs[passId]?.jiraTicketUrl || '');
                                                          return noteChanged || diagnosisChanged ? '#3b82f6' : '#9ca3af';
                                                        }
                                                        return noteChanged ? '#3b82f6' : '#9ca3af';
                                                      })(),
                                                      border: 'none',
                                                      borderRadius: '4px',
                                                      cursor: (() => {
                                                        if (savingMetadata.has(passId) || metadataSuccess.has(passId)) return 'not-allowed';
                                                        const noteText = noteInputs[passId] || '';
                                                        const existingNoteText = passNotesData.length > 0 ? passNotesData[0].note_text : '';
                                                        const noteChanged = noteText.trim() !== existingNoteText.trim();
                                                        if (!pass.success) {
                                                          const diagnosisChanged = 
                                                            (passDiagnoses.get(passId)?.symptom || '') !== (diagnosisInputs[passId]?.symptom || '') ||
                                                            (passDiagnoses.get(passId)?.cause || '') !== (diagnosisInputs[passId]?.cause || '') ||
                                                            (passDiagnoses.get(passId)?.jira_ticket_url || '') !== (diagnosisInputs[passId]?.jiraTicketUrl || '');
                                                          return noteChanged || diagnosisChanged ? 'pointer' : 'not-allowed';
                                                        }
                                                        return noteChanged ? 'pointer' : 'not-allowed';
                                                      })(),
                                                      transition: 'background-color 0.2s',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '6px'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                      const noteText = noteInputs[passId] || '';
                                                      const existingNoteText = passNotesData.length > 0 ? passNotesData[0].note_text : '';
                                                      const noteChanged = noteText.trim() !== existingNoteText.trim();
                                                      let hasChanges = noteChanged;
                                                      if (!pass.success) {
                                                        const diagnosisChanged = 
                                                          (passDiagnoses.get(passId)?.symptom || '') !== (diagnosisInputs[passId]?.symptom || '') ||
                                                          (passDiagnoses.get(passId)?.cause || '') !== (diagnosisInputs[passId]?.cause || '') ||
                                                          (passDiagnoses.get(passId)?.jira_ticket_url || '') !== (diagnosisInputs[passId]?.jiraTicketUrl || '');
                                                        hasChanges = noteChanged || diagnosisChanged;
                                                      }
                                                      if (hasChanges && !savingMetadata.has(passId) && !metadataSuccess.has(passId)) {
                                                        e.currentTarget.style.backgroundColor = '#2563eb';
                                                      }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                      const noteText = noteInputs[passId] || '';
                                                      const existingNoteText = passNotesData.length > 0 ? passNotesData[0].note_text : '';
                                                      const noteChanged = noteText.trim() !== existingNoteText.trim();
                                                      let hasChanges = noteChanged;
                                                      if (!pass.success) {
                                                        const diagnosisChanged = 
                                                          (passDiagnoses.get(passId)?.symptom || '') !== (diagnosisInputs[passId]?.symptom || '') ||
                                                          (passDiagnoses.get(passId)?.cause || '') !== (diagnosisInputs[passId]?.cause || '') ||
                                                          (passDiagnoses.get(passId)?.jira_ticket_url || '') !== (diagnosisInputs[passId]?.jiraTicketUrl || '');
                                                        hasChanges = noteChanged || diagnosisChanged;
                                                      }
                                                      if (hasChanges && !savingMetadata.has(passId) && !metadataSuccess.has(passId)) {
                                                        e.currentTarget.style.backgroundColor = '#3b82f6';
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
                                                            animation: 'spin 1s linear infinite'
                                                          }}
                                                        />
                                                        Saving...
                                                      </>
                                                    ) : metadataSuccess.has(passId) ? '✓ Saved' : 'Save'}
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Parent container for Files and Notes columns */}
                                        <div style={{ display: 'flex', margin: '0 12px' }}>
                                          {/* Column 1: Files captured during this pass */}
                                          <div style={{ flex: '2 1 0%', minWidth: 0 }}>
                                            <PassFiles
                                              pass={pass}
                                              binaryDataManager={binaryDataManager.current}
                                              viamClient={viamClient}
                                              fetchTimestamp={fetchTimestamp}
                                              expandedFiles={expandedFiles}
                                              toggleFilesExpansion={toggleFilesExpansion}
                                              fileSearchInputs={fileSearchInputs}
                                              handleFileSearchChange={handleFileSearchChange}
                                              debouncedFileSearchInputs={debouncedFileSearchInputs}
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
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
    );
};

export default HistoryTable;