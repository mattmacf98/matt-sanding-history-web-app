import { useEffect, useState } from 'react'
import { JsonValue } from '@viamrobotics/sdk'
import { Pass, PassNote, PassDiagnosis } from './lib/types'
import { getPassMetadataManager } from './lib/passMetadataManager'
import { useViamClients } from './lib/contexts/ViamClientContext'
import { useEnvironment } from './lib/contexts/EnvironmentContext'
import AppInterface from './AppInterface'
import NewAppInterface from './NewAppInterface'
import { useFiles } from './lib/contexts/FilesContext'

const sandingSummaryName = 'sanding-summary'
const sandingSummaryComponentType = 'rdk:component:sensor'
const BATCH_SIZE = 100

function App() {
  const { locationId, machineId, machineName, organizationId, viamClient } =
    useViamClients()
  const { legacy } = useEnvironment()
  const { fetchFiles, fetchTimestamp, files, videoFiles, imageFiles } =
    useFiles()

  const [passSummaries, setPassSummaries] = useState<Pass[]>([])

  const [partId, setPartId] = useState<string>('')
  const [passNotes, setPassNotes] = useState<Map<string, PassNote[]>>(new Map())
  const [passDiagnoses, setPassDiagnoses] = useState<
    Map<string, PassDiagnosis>
  >(new Map())
  const [fetchingNotes, setFetchingNotes] = useState<boolean>(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 7 // 7 days per page

  useEffect(() => {
    const fetchPasses = async () => {
      console.log('Fetching data start')

      // batched fetching of pass summaries
      let allTabularData: any[] = []
      let hasMoreData = true
      let oldestTimeReceived: string | null = null

      while (hasMoreData) {
        const baseQuery: Record<string, JsonValue>[] = [
          {
            $match: {
              organization_id: organizationId,
              location_id: locationId,
              component_name: sandingSummaryName,
              robot_id: machineId,
              component_type: sandingSummaryComponentType,
            },
          },
          {
            $sort: {
              time_received: -1,
            },
          },
        ]

        // Add time filter for pagination if we have a previous batch
        if (oldestTimeReceived) {
          ;(baseQuery[0].$match as Record<string, JsonValue>).time_received = {
            $lt: oldestTimeReceived,
          }
        }

        // Add limit
        const mqlQuery = [
          ...baseQuery,
          {
            $limit: BATCH_SIZE,
          },
        ]

        console.log(
          `Fetching batch of sanding summaries${oldestTimeReceived ? ' older than ' + new Date(oldestTimeReceived).toISOString() : ''}`
        )
        const batchData = await viamClient.dataClient.tabularDataByMQL(
          organizationId,
          mqlQuery
        )
        console.log(`Received ${batchData.length} records in batch`)

        // If we have data, process it
        if (batchData.length > 0) {
          // Get the oldest time_received from this batch for next query
          const lastItem = batchData[batchData.length - 1]

          if ('time_received' in lastItem) {
            oldestTimeReceived = lastItem.time_received as string
          } else {
            console.error(
              "Cannot find 'time_received' field for pagination in tabular data response:",
              lastItem
            )
            hasMoreData = false
          }

          allTabularData = [...allTabularData, ...batchData]

          // If we have fewer records than the batch size, we're done
          if (batchData.length < BATCH_SIZE) {
            hasMoreData = false
          }
        } else {
          // No more data
          hasMoreData = false
        }
      }

      console.log(
        `Total tabular data records fetched: ${allTabularData.length}`
      )

      let extractedPartId = ''
      if (allTabularData && allTabularData.length > 0) {
        extractedPartId = (allTabularData[0] as any).part_id || ''
        setPartId(extractedPartId)
      }

      // Process tabular data into pass summaries
      const processedPasses: Pass[] = allTabularData.map((item: any) => {
        const pass = item.data!.readings!
        const buildInfo = pass.build_info ? pass.build_info : {}

        return {
          start: new Date(pass.start),
          end: new Date(pass.end),
          steps: pass.steps
            ? pass.steps.map((x: any) => ({
                name: x.name!,
                start: new Date(x.start),
                end: new Date(x.end),
                pass_id: pass.pass_id,
              }))
            : [],
          success: pass.success ?? true,
          pass_id: pass.pass_id,
          err_string: pass.err_string || null,
          build_info: buildInfo,
          blue_point_count:
            pass.target_points_count !== undefined &&
            pass.target_points_count !== null
              ? Number(pass.target_points_count)
              : undefined,
          sanding_distance_mm:
            pass.sanding_distance_mm !== undefined &&
            pass.sanding_distance_mm !== null
              ? Number(pass.sanding_distance_mm)
              : undefined,
          selected_zones:
            pass.selected_zones !== undefined && pass.selected_zones !== null
              ? pass.selected_zones
              : undefined,
          selected_num_rounds:
            pass.selected_num_rounds !== undefined &&
            pass.selected_num_rounds !== null
              ? Number(pass.selected_num_rounds)
              : undefined,
        }
      })

      // Calculate percentage difference in blue points
      for (let i = 0; i < processedPasses.length - 1; i++) {
        const current = processedPasses[i]
        const previous = processedPasses[i + 1]

        if (
          current.blue_point_count !== undefined &&
          previous.blue_point_count !== undefined &&
          previous.blue_point_count !== 0
        ) {
          const diff = current.blue_point_count - previous.blue_point_count
          current.blue_point_diff_percent =
            (diff / previous.blue_point_count) * 100
        }
      }

      setPassSummaries(processedPasses)

      // Fetch all notes and diagnoses for all passes
      if (processedPasses.length > 0 && extractedPartId) {
        const passIds = processedPasses
          .map((pass) => pass.pass_id)
          .filter(Boolean)

        setFetchingNotes(true)

        const metadataManager = getPassMetadataManager(viamClient, machineId)
        const [fetchedNotes, fetchedDiagnoses] = await Promise.all([
          metadataManager.fetchNotesForPasses(passIds),
          metadataManager.fetchDiagnosesForPasses(passIds),
        ])

        setPassNotes(fetchedNotes)
        setPassDiagnoses(fetchedDiagnoses)
        setFetchingNotes(false)
      }

      console.log('Fetching data end')
    }

    fetchPasses()
  }, [locationId, machineId, organizationId, viamClient])

  // Fetch videos when passSummaries and viamClient are available
  useEffect(() => {
    if (passSummaries.length > 0 && viamClient) {
      const earliestVideoTime = passSummaries[passSummaries.length - 1].start
      fetchFiles(earliestVideoTime, true)
    }
  }, [passSummaries, viamClient])

  // After fetching all pass summaries, add grouping by day logic
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber)
  }

  // Group passes by day
  const groupedByDay = passSummaries.reduce(
    (acc: Record<string, Pass[]>, pass) => {
      // Use a consistent date key (YYYY-MM-DD)
      const dateKey = pass.start.toISOString().split('T')[0]
      if (!acc[dateKey]) {
        acc[dateKey] = []
      }
      acc[dateKey].push(pass)
      return acc
    },
    {}
  )

  // Get sorted day keys (dates)
  const sortedDays = Object.keys(groupedByDay).sort().reverse() // Most recent first

  // Paginate by days
  const indexOfLastDay = currentPage * itemsPerPage
  const indexOfFirstDay = indexOfLastDay - itemsPerPage
  const currentDays = sortedDays.slice(indexOfFirstDay, indexOfLastDay)

  // Get all passes for the current days
  const currentPassSummaries = currentDays.flatMap((day) => groupedByDay[day])

  const totalPages = Math.ceil(sortedDays.length / itemsPerPage)

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
          itemsPerPage,
          totalItems: sortedDays.length,
          totalEntries: passSummaries.length,
          onPageChange: handlePageChange,
          currentDaysDisplayed: currentDays.length,
          daysPerPage: true,
        }}
      />
    )
  } else {
    return (
      <NewAppInterface
        passSummaries={currentPassSummaries}
        partId={partId}
        passNotes={passNotes}
        onNotesUpdate={setPassNotes}
        passDiagnoses={passDiagnoses}
        onDiagnosesUpdate={setPassDiagnoses}
        fetchingNotes={fetchingNotes}
        pagination={{
          currentPage,
          totalPages,
          itemsPerPage,
          totalItems: sortedDays.length,
          totalEntries: passSummaries.length,
          onPageChange: handlePageChange,
          currentDaysDisplayed: currentDays.length,
          daysPerPage: true,
        }}
      />
    )
  }
}

export default App
