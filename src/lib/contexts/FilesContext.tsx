import { createContext, useContext, useState, ReactNode } from 'react'
import * as VIAM from '@viamrobotics/sdk'
import { useViamClients } from './ViamClientContext'
import { Timestamp } from '@bufbuild/protobuf'

interface FilesContextType {
  fetchTimestamp: Date | null
  files: Map<string, VIAM.dataApi.BinaryData>
  videoFiles: Map<string, VIAM.dataApi.BinaryData>
  imageFiles: Map<string, VIAM.dataApi.BinaryData>
  fetchFiles: (start: Date, shouldSetLoadingState?: boolean) => Promise<void>
}

const FilesContext = createContext<FilesContextType | undefined>(undefined)

export function FilesProvider({ children }: { children: ReactNode }) {
  const { viamClient, machineId } = useViamClients()
  const [fetchTimestamp, setFetchTimestamp] = useState<Date | null>(null)
  const [files, setFiles] = useState<Map<string, VIAM.dataApi.BinaryData>>(
    new Map()
  )
  const [videoFiles, setVideoFiles] = useState<
    Map<string, VIAM.dataApi.BinaryData>
  >(new Map())
  const [imageFiles, setImageFiles] = useState<
    Map<string, VIAM.dataApi.BinaryData>
  >(new Map())

  // TODO: don't export this, just have it react to a pass context (to be made in future) change
  const fetchFiles = async (
    start: Date,
    shouldSetLoadingState: boolean = true
  ) => {
    const end = new Date()

    console.log('Fetching for time range:', start, end)
    if (shouldSetLoadingState) {
      setFetchTimestamp(start)
    }

    const filter = {
      robotId: machineId,
      interval: {
        start: Timestamp.fromDate(start),
        end: Timestamp.fromDate(end),
      } as VIAM.dataApi.CaptureInterval,
    } as VIAM.dataApi.Filter

    let paginationToken: string | undefined = undefined

    // Process files in batches
    while (true) {
      const binaryData = await viamClient.dataClient.binaryDataByFilter(
        filter,
        1000,
        VIAM.dataApi.Order.DESCENDING,
        paginationToken,
        false,
        false,
        false
      )

      const newFiles = new Map<string, VIAM.dataApi.BinaryData>()
      const newVideoFiles = new Map<string, VIAM.dataApi.BinaryData>()
      const newImages = new Map<string, VIAM.dataApi.BinaryData>()

      binaryData.data.forEach((file) => {
        if (file.metadata?.binaryDataId) {
          const isVideo = file.metadata.fileName?.toLowerCase().includes('.mp4')
          const isImageFile = file.metadata.fileName
            ?.toLowerCase()
            .match(/\.(png|jpg|jpeg)$/)
          const isCameraCapture =
            file.metadata.captureMetadata?.componentName &&
            file.metadata.captureMetadata?.methodName

          if (isVideo) {
            // Video files go to videoFiles
            newVideoFiles.set(file.metadata.binaryDataId, file)
          } else if (isImageFile || isCameraCapture) {
            // Image files go to images
            newImages.set(file.metadata.binaryDataId, file)
          } else {
            // Other files go to files
            newFiles.set(file.metadata.binaryDataId, file)
          }
        }
      })

      paginationToken = binaryData.last

      if (binaryData.data.length > 0 && shouldSetLoadingState) {
        setFetchTimestamp(
          binaryData.data[
            binaryData.data.length - 1
          ].metadata!.timeRequested!.toDate()
        )
      }

      setFiles((prevFiles) => {
        const updatedFiles = new Map(prevFiles)
        newFiles.forEach((file, id) => {
          updatedFiles.set(id, file)
        })
        return updatedFiles
      })

      setVideoFiles((prevVideoFiles) => {
        const updatedVideoFiles = new Map(prevVideoFiles)
        newVideoFiles.forEach((file, id) => {
          updatedVideoFiles.set(id, file)
        })
        return updatedVideoFiles
      })

      setImageFiles((prevImageFiles) => {
        const updatedImageFiles = new Map(prevImageFiles)
        newImages.forEach((file, id) => {
          updatedImageFiles.set(id, file)
        })
        return updatedImageFiles
      })

      // Break if no more data to fetch
      if (!binaryData.last) break
    }
    console.log('total files count:', files.size)
    console.log('total video files count:', videoFiles.size)

    if (shouldSetLoadingState) {
      setFetchTimestamp(null)
    }
  }

  return (
    <FilesContext.Provider
      value={{ fetchTimestamp, files, videoFiles, imageFiles, fetchFiles }}
    >
      {children}
    </FilesContext.Provider>
  )
}

export function useFiles() {
  const context = useContext(FilesContext)
  if (context === undefined) {
    throw new Error('useFiles must be used within an FilesProvider')
  }
  return context
}
