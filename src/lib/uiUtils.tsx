/**
 * Formats a duration from milliseconds to a string like "Xh Ym" or "Ym".
 * Includes a tooltip showing the duration in minutes.
 * @param ms - The duration in milliseconds.
 * @returns A JSX element with the formatted duration.
 */
export const formatDurationMs = (ms: number): JSX.Element => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  let displayText: string
  if (hours > 0) {
    displayText = `${hours}h ${minutes}m`
  } else {
    displayText = `${minutes}m`
  }

  return <span title={`${Math.floor(ms / 60000)} minutes`}>{displayText}</span>
}

/**
 * Constructs a URL to the Viam app logs page filtered to a specific time range.
 * @param startTime - The start time for the logs.
 * @param endTime - The end time for the logs.
 * @param machineId - The machine ID.
 * @param organizationId - The organization ID.
 * @returns A URL string to the Viam logs page.
 */
export const constructStepLogUrl = (
  startTime: Date,
  endTime: Date,
  machineId: string,
  organizationId: string
): string => {
  const startParam = encodeURIComponent(startTime.toISOString())
  const endParam = encodeURIComponent(endTime.toISOString())

  return `https://app.viam.com/machine/${machineId}/logs?start=${startParam}&end=${endParam}&org=${organizationId}`
}
