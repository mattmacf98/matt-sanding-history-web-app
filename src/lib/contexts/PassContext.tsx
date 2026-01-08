import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react'
import { Pass, PassNote, PassDiagnosis } from '../types'
import { JsonValue } from '@viamrobotics/sdk'
import { useViamClients } from './ViamClientContext'
import { getPassMetadataManager } from '../passMetadataManager'

const sandingSummaryName = 'sanding-summary'
const sandingSummaryComponentType = 'rdk:component:sensor'
const BATCH_SIZE = 100

// TODO: decompose this more into a notes and diagnoses context and a pass summaries context which use this data
interface PassContextType {
  passSummaries: Pass[]
  passSummariesByDay: Record<string, Pass[]>
  partId: string
  passNotes: Map<string, PassNote[]>
  setPassNotes: React.Dispatch<React.SetStateAction<Map<string, PassNote[]>>>
  passDiagnoses: Map<string, PassDiagnosis>
  setPassDiagnoses: React.Dispatch<
    React.SetStateAction<Map<string, PassDiagnosis>>
  >
  fetchingNotes: boolean
  fetchPasses: () => Promise<void>
}

const PassContext = createContext<PassContextType | undefined>(undefined)

export function PassProvider({ children }: { children: ReactNode }) {
  const { locationId, machineId, organizationId, viamClient } = useViamClients()

  const [passSummaries, setPassSummaries] = useState<Pass[]>([])
  const [passSummariesByDay, setPassSummariesByDay] = useState<
    Record<string, Pass[]>
  >({})
  const [partId, setPartId] = useState<string>('')
  const [passNotes, setPassNotes] = useState<Map<string, PassNote[]>>(new Map())
  const [passDiagnoses, setPassDiagnoses] = useState<
    Map<string, PassDiagnosis>
  >(new Map())
  const [fetchingNotes, setFetchingNotes] = useState<boolean>(false)

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

    console.log(`Total tabular data records fetched: ${allTabularData.length}`)

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

  useEffect(() => {
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

    setPassSummariesByDay(groupedByDay)
  }, [passSummaries])

  return (
    <PassContext.Provider
      value={{
        passSummaries,
        passSummariesByDay,
        partId,
        passNotes,
        setPassNotes,
        passDiagnoses,
        setPassDiagnoses,
        fetchingNotes,
        fetchPasses,
      }}
    >
      {children}
    </PassContext.Provider>
  )
}

export function usePass() {
  const context = useContext(PassContext)
  if (context === undefined) {
    throw new Error('usePass must be used within a PassProvider')
  }
  return context
}
