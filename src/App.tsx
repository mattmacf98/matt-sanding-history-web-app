import { useEffect, useState } from 'react'
import { useViamClients } from './lib/contexts/ViamClientContext'
import { useEnvironment } from './lib/contexts/EnvironmentContext'
import AppInterface from './AppInterface'
import NewAppInterface from './NewAppInterface'
import { useFiles } from './lib/contexts/FilesContext'
import { usePass } from './lib/contexts/PassContext'
import { Pass } from './lib/types.ts'
import { usePagination, DAYS_PER_PAGE } from './lib/contexts/PaginationContext'

function App() {
  const { locationId, machineId, machineName, organizationId, viamClient } =
    useViamClients()
  const { legacy } = useEnvironment()
  const { fetchFiles, fetchTimestamp, files, videoFiles, imageFiles } =
    useFiles()
  const {
    passSummaries,
    passSummariesByDay,
    partId,
    passNotes,
    passDiagnoses,
    setPassNotes,
    setPassDiagnoses,
    fetchingNotes,
    fetchPasses,
  } = usePass()
  const {
    currentPage,
    changePage,
    totalPages,
    sortedDays,
    currentNumDaysDisplayed,
  } = usePagination()

  const [currentPassSummaries, setCurrentPassSummaries] = useState<Pass[]>([])

  useEffect(() => {
    fetchPasses()
  }, [locationId, machineId, organizationId, viamClient])

  // Fetch videos when passSummaries and viamClient are available
  useEffect(() => {
    if (passSummaries.length > 0 && viamClient) {
      const earliestVideoTime = passSummaries[passSummaries.length - 1].start
      fetchFiles(earliestVideoTime)
    }
  }, [passSummaries, viamClient])

  useEffect(() => {
    const indexOfLastDay = currentPage * DAYS_PER_PAGE
    const indexOfFirstDay = indexOfLastDay - DAYS_PER_PAGE
    const currentDays = sortedDays.slice(indexOfFirstDay, indexOfLastDay)

    // Get all passes for the current days
    const currentPassSummaries = currentDays.flatMap(
      (day) => passSummariesByDay[day]
    )
    setCurrentPassSummaries(currentPassSummaries)
  }, [passSummariesByDay, currentPage, sortedDays])

  if (legacy) {
    return (
      <AppInterface
        machineName={machineName}
        passSummaries={currentPassSummaries}
        files={files}
        videoFiles={videoFiles}
        imageFiles={imageFiles}
        fetchVideos={fetchFiles}
        fetchTimestamp={fetchTimestamp}
        machineId={machineId}
        partId={partId}
        passNotes={passNotes}
        onNotesUpdate={setPassNotes}
        passDiagnoses={passDiagnoses}
        onDiagnosesUpdate={setPassDiagnoses}
        fetchingNotes={fetchingNotes}
        pagination={{
          currentPage,
          totalPages,
          itemsPerPage: DAYS_PER_PAGE,
          totalItems: sortedDays.length,
          totalEntries: passSummaries.length,
          onPageChange: changePage,
          currentDaysDisplayed: currentNumDaysDisplayed,
          daysPerPage: true,
        }}
      />
    )
  } else {
    return (
      <NewAppInterface
        passSummaries={currentPassSummaries}
        files={files}
        videoFiles={videoFiles}
        imageFiles={imageFiles}
        fetchVideos={fetchFiles}
        fetchTimestamp={fetchTimestamp}
        partId={partId}
        passNotes={passNotes}
        onNotesUpdate={setPassNotes}
        passDiagnoses={passDiagnoses}
        onDiagnosesUpdate={setPassDiagnoses}
        fetchingNotes={fetchingNotes}
        pagination={{
          currentPage,
          totalPages,
          itemsPerPage: DAYS_PER_PAGE,
          totalItems: sortedDays.length,
          totalEntries: passSummaries.length,
          onPageChange: changePage,
          currentDaysDisplayed: currentNumDaysDisplayed,
          daysPerPage: true,
        }}
      />
    )
  }
}

export default App
