import * as VIAM from "@viamrobotics/sdk";
import { Pass, RobotConfigMetadata } from '../types';

/**
 * Extract metadata from a robot part history entry
 */
export const extractConfigMetadata = (entry: any): RobotConfigMetadata => {
  const configTimestamp = entry.when?.toDate ? entry.when.toDate() : new Date();

  return {
    partId: entry.part || '',
    robotId: entry.robot || '',
    configTimestamp,
    editedBy: entry.editedBy,
    hasOldConfig: !!entry.old
  };
};

/**
 * Get the robot configuration that was active at a specific time
 */
export const getRobotConfigAtTime = async (
  viamClient: VIAM.ViamClient,
  partId: string,
  timestamp: Date
): Promise<{ config: any; metadata: RobotConfigMetadata } | null> => {
  try {
    console.log("Fetching robot config for timestamp:", timestamp);

    // Fetch the robot part history
    const history = await viamClient.appClient.getRobotPartHistory(partId);

    if (!history || history.length === 0) {
      console.warn("No history found for part:", partId);
      return null;
    }

    console.log(`Found ${history.length} history entries`);

    // Find the config that was active at the given timestamp
    // We need the most recent entry where 'when' <= our timestamp
    let activeConfigEntry = null;

    for (const entry of history) {
      const entryTime = entry.when?.toDate ? entry.when.toDate() : null;

      if (!entryTime) continue;

      // Only consider entries at or before our target timestamp
      if (entryTime <= timestamp) {
        const activeConfigEntryTime = activeConfigEntry?.when?.toDate();

        if (!activeConfigEntryTime || entryTime > activeConfigEntryTime) {
          activeConfigEntry = entry;
        }
      }
    }

    if (!activeConfigEntry) {
      console.warn("No config found for timestamp:", timestamp);
      return null;
    }

    const metadata = extractConfigMetadata(activeConfigEntry);

    console.log("Found matching config entry from:", metadata.configTimestamp);
    console.log("Config entry details:", metadata);

    // Return both the config and its metadata - extract only robotConfig
    return {
      config: activeConfigEntry.old?.robotConfig || activeConfigEntry.old,
      metadata
    };
  } catch (error) {
    console.error("Error getting robot config at time:", error);
    throw error;
  }
};

/**
 * Compares the configuration of a pass with the previous pass.
 */
export const getPassConfigComparison = (
  pass: Pass,
  allPasses: Pass[],
  configMetadata: Map<string, RobotConfigMetadata>
): { prevPass: Pass | null; configChanged: boolean } => {
  const currentPassIndex = allPasses.findIndex(p => p.pass_id === pass.pass_id);
  const prevPass = (currentPassIndex > -1 && currentPassIndex < allPasses.length - 1)
    ? allPasses[currentPassIndex + 1]
    : null;

  if (!prevPass) {
    return { prevPass: null, configChanged: false };
  }

  const currentMeta = configMetadata.get(pass.pass_id);
  const prevMeta = configMetadata.get(prevPass.pass_id);

  const configChanged = !!(
    currentMeta &&
    prevMeta &&
    currentMeta.configTimestamp.getTime() !== prevMeta.configTimestamp.getTime()
  );

  return { prevPass, configChanged };
};

/**
 * Download robot configuration as a JSON file
 */
export const downloadRobotConfig = (
  config: any,
  passId: string,
  timestamp: Date,
  machineId: string
): void => {
  try {
    // Helper to pad numbers with a leading zero
    const pad = (num: number) => num.toString().padStart(2, '0');

    // Format the timestamp for filename using local time (YYYY-MM-DD-HH-MM-SS)
    const year = timestamp.getFullYear();
    const month = pad(timestamp.getMonth() + 1); // getMonth() is zero-based
    const day = pad(timestamp.getDate());
    const hours = pad(timestamp.getHours());
    const minutes = pad(timestamp.getMinutes());
    const seconds = pad(timestamp.getSeconds());

    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hours}-${minutes}-${seconds}`;
    const fileName = `config-${machineId.substring(0, 8)}-pass-${passId.substring(0, 8)}-${dateStr}-${timeStr}.json`;

    // Create a blob with formatted JSON
    const jsonStr = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';

    // Trigger download
    document.body.appendChild(a);
    a.click();

    // Cleanup
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    console.log(`Downloaded config as ${fileName}`);
  } catch (error) {
    console.error("Error downloading config:", error);
    throw error;
  }
};
