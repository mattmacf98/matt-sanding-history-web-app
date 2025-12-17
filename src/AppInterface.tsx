import React, { useState, useEffect } from 'react';
import * as VIAM from "@viamrobotics/sdk";

import './AppInterface.css';
import GlobalLoadingIndicator from './components/GlobalLoadingIndicator';
import { PassNote, PassDiagnosis } from './lib/types';
import { ResourceSelection } from './components/ResouceSelection';
import BeforeAfterModal from './components/BeforeAfterModal';
import { Pagination } from './components/HistoryTable/Pagination';
import HistoryTable from './components/HistoryTable';

interface AppViewProps {
  passSummaries?: any[];
  files: Map<string, VIAM.dataApi.BinaryData>;
  videoFiles: Map<string, VIAM.dataApi.BinaryData>;
  imageFiles: Map<string, VIAM.dataApi.BinaryData>;
  fetchVideos: (start: Date) => Promise<void>;
  machineName: string | null;
  fetchTimestamp: Date | null;
  machineId: string;
  partId: string;
  passNotes: Map<string, PassNote[]>;
  onNotesUpdate: React.Dispatch<React.SetStateAction<Map<string, PassNote[]>>>;
  passDiagnoses: Map<string, PassDiagnosis>;
  onDiagnosesUpdate: React.Dispatch<React.SetStateAction<Map<string, PassDiagnosis>>>;
  fetchingNotes: boolean;
  pagination?: {
    currentPage: number;
    totalPages: number;
    itemsPerPage: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    daysPerPage?: boolean;
    currentDaysDisplayed?: number;
    totalEntries?: number;
  };
}

const AppInterface: React.FC<AppViewProps> = ({
  machineName,
  passSummaries = [],
  files,
  videoFiles,
  imageFiles,
  fetchVideos,
  fetchTimestamp,
  machineId,
  partId,
  passNotes,
  onNotesUpdate,
  passDiagnoses,
  onDiagnosesUpdate,
  fetchingNotes,
  pagination,
}) => {
  const [videoStoreClient, setVideoStoreClient] = useState<VIAM.GenericComponentClient | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<string>(() => {
    // Initialize from localStorage if available
    return localStorage.getItem('selectedCamera') || '';
  });
  const [beforeAfterModal, setBeforeAfterModal] = useState<{
    beforeImage: VIAM.dataApi.BinaryData | null;
    afterImage: VIAM.dataApi.BinaryData | null;
  } | null>(null);
  const [hasAutoSelectedCamera, setHasAutoSelectedCamera] = useState(false);

  const cameraComponentNames = Array.from(
    new Set(
      Array.from(imageFiles.values())
        .filter(file => file.metadata?.captureMetadata?.componentType === 'rdk:component:camera')
        .map(file => file.metadata?.captureMetadata?.componentName)
        .filter((name): name is string => !!name)
    )
  );

  // Auto-select camera: if only one available, select it; otherwise restore from localStorage
  // Only runs once on initial load
  useEffect(() => {
    if (cameraComponentNames.length === 0 || hasAutoSelectedCamera) return;
    
    // Mark that we've done the auto-selection
    setHasAutoSelectedCamera(true);
    
    // If only one camera, auto-select it
    if (cameraComponentNames.length === 1) {
      const onlyCamera = cameraComponentNames[0];
      setSelectedCamera(onlyCamera);
      localStorage.setItem('selectedCamera', onlyCamera);
      return;
    }
    
    // If multiple cameras, try to restore from localStorage
    const savedCamera = localStorage.getItem('selectedCamera');
    if (savedCamera && cameraComponentNames.includes(savedCamera)) {
      setSelectedCamera(savedCamera);
    }
  }, [cameraComponentNames, hasAutoSelectedCamera]);


  const closeBeforeAfterModal = () => {
    setBeforeAfterModal(null);
  };

  return (
    <div className="appInterface">
      <header className="flex items-center sticky top-0 z-10 mb-4 px-4 py-3 border-b bg-zinc-50 shadow-none md:shadow-xs">
        <div className="w-1/3 h-5 font-semibold text-zinc-900">Sanding history</div>
        <div className="w-1/3"></div>
      </header>

      <main className="mainContent">
          <section>
            <ResourceSelection machineName={machineName || ''} setVideoStoreClient={setVideoStoreClient} cameraComponentNames={cameraComponentNames} selectedCamera={selectedCamera} setSelectedCamera={setSelectedCamera} />

            <HistoryTable
              videoStoreClient={videoStoreClient}
              setBeforeAfterModal={setBeforeAfterModal}
              partId={partId}
              machineId={machineId}
              passSummaries={passSummaries}
              fetchingNotes={fetchingNotes}
              passNotes={passNotes}
              passDiagnoses={passDiagnoses}
              onNotesUpdate={onNotesUpdate}
              onDiagnosesUpdate={onDiagnosesUpdate}
              selectedCamera={selectedCamera}
              imageFiles={imageFiles}
              videoFiles={videoFiles}
              fetchTimestamp={fetchTimestamp}
              fetchVideos={fetchVideos}
              files={files}
            />
          </section>
      </main>

      {pagination && (
        <Pagination pagination={pagination} passSummaries={passSummaries} />
      )}
      {/* Add the modal at the end */}
      {beforeAfterModal && (
        <BeforeAfterModal
          beforeImage={beforeAfterModal.beforeImage}
          afterImage={beforeAfterModal.afterImage}
          onClose={closeBeforeAfterModal}
        />
      )}

      <GlobalLoadingIndicator 
        isLoading={!!fetchTimestamp} 
        currentDate={fetchTimestamp}
        fileCount={files.size + videoFiles.size + imageFiles.size}
      />
    </div>
  );
};

export default AppInterface;