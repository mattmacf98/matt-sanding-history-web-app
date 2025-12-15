import * as VIAM from "@viamrobotics/sdk";
import { Pass } from "../../lib/types";
import { useViamClients } from "../../ViamClientContext";
import { useMemo } from "react";

interface PassFilesProps {
    pass: Pass;
    files: Map<string, VIAM.dataApi.BinaryData>;
    viamClient: VIAM.ViamClient;
    fetchTimestamp: Date | null;
    expandedFiles: Set<string>;
    toggleFilesExpansion: (passId: string) => void;
    fileSearchInputs: Record<string, string>;
    handleFileSearchChange: (passId: string, value: string) => void;
    debouncedFileSearchInputs: Record<string, string>;
    partId: string;
  }

export const PassFiles: React.FC<PassFilesProps> = ({
    pass,
    files,
    fetchTimestamp,
    expandedFiles,
    toggleFilesExpansion,
    fileSearchInputs,
    handleFileSearchChange,
    debouncedFileSearchInputs,
    partId,
  }) => {
    const { machineId, organizationId, viamClient } = useViamClients();
  
    const passId = pass.pass_id;
  
    const handleDownload = async (file: VIAM.dataApi.BinaryData) => {
      try {
        const data = await viamClient.dataClient.binaryDataByIds([file.metadata!.binaryDataId]);
        if (data.length > 0) {
          const blob = new Blob([new Uint8Array(data[0].binary)]);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.metadata?.fileName?.split('/').pop() || 'download';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      } catch (error) {
        console.error('Error downloading file:', error);
        alert('Failed to download file');
      }
    };
  
    const passFiles = useMemo(() => {
      const passStart = new Date(pass.start);
      const passEnd = new Date(pass.end);
  
      const passTimeRangeFileIDS: string[] = [];
      files.forEach((file, binaryDataId) => {
        if (file.metadata?.timeRequested) {
          const fileTime = file.metadata.timeRequested.toDate();
          if (fileTime >= passStart && fileTime <= passEnd) {
            passTimeRangeFileIDS.push(binaryDataId);
          }
        }
      });
  
      const passFileIDs: string[] = [];
      if (pass.pass_id && pass.pass_id.trim() !== '') {
        files.forEach((file, binaryDataId) => {
          if (file.metadata?.fileName && file.metadata.fileName.split("/").filter((y) => y === pass.pass_id).length > 0) {
            passFileIDs.push(binaryDataId);
          }
        });
      }
  
      const ids = new Set([...passFileIDs, ...passTimeRangeFileIDS]);
      return Array.from(files.values())
        .filter((x) => ids.has(x.metadata!.binaryDataId))
        .sort((a, b) => {
          const timeA = a.metadata!.timeRequested!.toDate().getTime();
          const timeB = b.metadata!.timeRequested!.toDate().getTime();
          return timeA - timeB;
        });
    }, [pass, files]);
  
    const filteredPassFiles = useMemo(() => {
      const searchTerm = (debouncedFileSearchInputs[passId] || '').toLowerCase();
      if (!searchTerm) return passFiles;
  
      return passFiles.filter(file => {
        const fileName = file.metadata?.fileName?.split('/').pop()?.toLowerCase() || '';
        const fullPath = file.metadata?.fileName?.toLowerCase() || '';
        return fileName.includes(searchTerm) || fullPath.includes(searchTerm);
      });
    }, [passFiles, debouncedFileSearchInputs, passId]);
  
    const filesCountDisplay = useMemo(() => {
      const searchTerm = (debouncedFileSearchInputs[passId] || '').toLowerCase();
      if (searchTerm) {
        return `(showing ${filteredPassFiles.length} of ${passFiles.length})`;
      }
      return `(${passFiles.length})`;
    }, [passFiles.length, filteredPassFiles.length, debouncedFileSearchInputs, passId]);
  
    const isLoading = fetchTimestamp && fetchTimestamp > pass.start;
  
    if (isLoading && passFiles.length === 0) {
      return (
        <div className="pass-files-section" style={{}}>
          <span style={{
            display: 'inline-block',
            width: '28px',
            height: '28px',
            border: '3px solid rgba(59, 130, 246, 0.2)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></span>
          <p style={{ marginTop: '12px', color: '#6b7280', fontSize: '14px' }}>
            Loading files...
          </p>
        </div>
      );
    }
  
    return (
      <div className="pass-files-section">
        <h4
          onClick={() => toggleFilesExpansion(passId)}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            userSelect: 'none',
            paddingLeft: '2px'
          }}
        >
          <span style={{
            display: 'inline-block',
            transition: 'transform 0.2s',
            transform: expandedFiles.has(passId) ? 'rotate(90deg)' : 'rotate(0deg)',
            fontSize: '10px'
          }}>
            ▶
          </span>
          Files captured during this pass {filesCountDisplay}
        </h4>
  
        {expandedFiles.has(passId) && passFiles.length > 0 && (
          <>
            <div style={{ marginTop: '8px', marginLeft: '12px', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="Search files by filename..."
                value={fileSearchInputs[passId] || ''}
                onChange={(e) => handleFileSearchChange(passId, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 'fit-content',
                  minWidth: '250px',
                  maxWidth: '400px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0',
              overflowY: 'auto',
              maxHeight: '33dvh',
              overflow: 'auto',
              borderTop: '1px solid #e5e7eb',
              margin: '0 0 0 0.5rem'
            }}>
              {filteredPassFiles
                .map((file, fileIndex, filteredFiles) => {
                  const fileName = file.metadata?.fileName?.split('/').pop() || 'Unknown file';
  
                  return (
                    <div
                      key={fileIndex}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 6px',
                        backgroundColor: '#f9fafb',
                        borderBottom: fileIndex < filteredFiles.length - 1 ? '1px solid #e5e7eb' : 'none',
                        fontSize: '13px',
                        minWidth: '280px',
                        boxSizing: 'border-box',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden'
                      }}>
                        <span style={{
                          color: '#374151',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          flex: 1
                        }} title={file.metadata?.fileName || fileName}>
                          {fileName}
                        </span>
                        <span style={{
                          color: '#9ca3af',
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          {file.metadata?.timeRequested?.toDate().toLocaleTimeString() || ''}
                        </span>
                      </div>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDownload(file);
                        }}
                        style={{
                          marginLeft: '12px',
                          padding: '6px 8px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          borderRadius: '4px',
                          textDecoration: 'none',
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          cursor: 'pointer',
                          display: 'inline-block',
                          border: 'none'
                        }}
                      >
                        Download
                      </a>
                      <a
                        href={
                          `https://storage.cloud.google.com/viam-data-${organizationId}/` +
                          `${organizationId}/${machineId}/${partId}/files/` +
                          `${file.metadata?.binaryDataId.split("/").pop()}` +
                          `${file.metadata?.fileName}.gz`
                        }
                        target="_blank"
                        style={{
                          marginLeft: '12px',
                          padding: '6px 8px',
                          backgroundColor: '#1d4ed8',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '12px',
                          border: 'none',
                          textDecoration: 'none'
                        }}
                      >
                        Download from GCS
                      </a>
                    </div>
                  );
                })}
              {filteredPassFiles.length === 0 && fileSearchInputs[passId] && (
                <div style={{
                  padding: '12px',
                  color: '#6b7280',
                  fontSize: '13px'
                }}>
                  No files match "{fileSearchInputs[passId]}"
                </div>
              )}
            </div>
          </>
        )}
  
        {passFiles.length === 0 && !isLoading && (
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px', paddingLeft: '30px' }}>
            No files found for this pass.
          </p>
        )}
      </div>
    );
  };