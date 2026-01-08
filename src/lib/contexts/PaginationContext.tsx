import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import { usePass } from './PassContext'
export const DAYS_PER_PAGE = 7

interface PaginationContextType {
  currentPage: number
  totalPages: number
  totalEntries: number
  currentNumDaysDisplayed: number
  changePage: (page: number) => void
  sortedDays: string[]
}

const PaginationContext = createContext<PaginationContextType | undefined>(
  undefined
)

export function PaginationProvider({ children }: { children: ReactNode }) {
  const { passSummariesByDay, passSummaries } = usePass()

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalEntries, setTotalEntries] = useState<number>(1)
  const [sortedDays, setSortedDays] = useState<string[]>([])
  const [currentNumDaysDisplayed, setCurrentNumDaysDisplayed] =
    useState<number>(1)

  useEffect(() => {
    // Get sorted day keys (dates)
    const sortedDays = Object.keys(passSummariesByDay).sort().reverse() // Most recent first

    // Paginate by days
    const indexOfLastDay = currentPage * DAYS_PER_PAGE
    const indexOfFirstDay = indexOfLastDay - DAYS_PER_PAGE
    const currentDays = sortedDays.slice(indexOfFirstDay, indexOfLastDay)

    const totalPages = Math.ceil(sortedDays.length / DAYS_PER_PAGE)

    setTotalPages(totalPages)
    setSortedDays(sortedDays)
    setTotalEntries(passSummaries.length)
    setCurrentNumDaysDisplayed(currentDays.length)
  }, [passSummariesByDay, passSummaries])

  return (
    <PaginationContext.Provider
      value={{
        currentPage,
        totalPages,
        totalEntries,
        currentNumDaysDisplayed,
        changePage: setCurrentPage,
        sortedDays,
      }}
    >
      {children}
    </PaginationContext.Provider>
  )
}

export function usePagination() {
  const context = useContext(PaginationContext)
  if (context === undefined) {
    throw new Error('usePagination must be used within a PaginationProvider')
  }
  return context
}
