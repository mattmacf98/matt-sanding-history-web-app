import * as VIAM from "@viamrobotics/sdk";
import { Pass, RobotConfigMetadata, RobotConfig } from './types';

/**
 * Extract metadata from a robot part history entry
 */
export const extractConfigMetadata = (entry: any): RobotConfigMetadata => {
  const configTimestamp = entry.when?.toDate ? entry.when.toDate() : new Date();

  return {
    partId: entry.part || '',
    robotId: entry.robot || '',
    configTimestamp,
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
): Promise<{ config: RobotConfig; metadata: RobotConfigMetadata } | null> => {
  try {
    // Fetch the robot part history. The history is sorted from newest to oldest.
    const history = await viamClient.appClient.getRobotPartHistory(partId);

    if (!history || history.length === 0) {
      return null;
    }

    // Find the first history entry that occurred AT or BEFORE the requested timestamp.
    // This entry represents the last change made before or at our target time.
    const lastChangeEntry = history.find(entry => {
      const entryTime = entry.when?.toDate();
      return entryTime && entryTime <= timestamp;
    });

    // If no such entry exists, the timestamp is before any recorded history.
    if (!lastChangeEntry) {
      return null;
    }

    // The configuration that was active is the state AFTER this last change.
    // This state is stored in the `old` field of the NEXT NEWER entry in the history.
    const lastChangeIndex = history.indexOf(lastChangeEntry);

    let baseConfig: any;
    if (lastChangeIndex > 0) {
      // The next newer entry is at the previous index because the list is sorted newest to oldest.
      const configEntry = history[lastChangeIndex - 1];
      const robotPart = configEntry?.old;

      if (!robotPart || !robotPart.robotConfig) {
        console.error("Invalid config structure in history entry (from history)");
        return null;
      }
      // The config is nested under robotConfig
      baseConfig = robotPart.robotConfig.toJson();
    } else {
      // If the last change is the most recent one in history (index 0),
      // the active config is the absolute latest. Fetch the part directly.
      const robotPartResponse = await viamClient.appClient.getRobotPart(partId);

      if (!robotPartResponse?.part) {
        console.error("Could not fetch current robot part");
        return null;
      }
      // The config is on the .part property of the response
      baseConfig = robotPartResponse.part.robotConfig ? robotPartResponse.part.robotConfig.toJson() : null;
    }

    if (!baseConfig) {
      console.error("Could not derive a base config.");
      return null;
    }

    // Sort fragment mods for consistent diffing
    if (baseConfig.fragment_mods && Array.isArray(baseConfig.fragment_mods)) {
      for (const fragmentMod of baseConfig.fragment_mods) {
        if (fragmentMod.mods && Array.isArray(fragmentMod.mods)) {
          fragmentMod.mods.sort((a: any, b: any) => {
            const keyA = a.$set ? Object.keys(a.$set)[0] : Object.keys(a.$unset)[0];
            const keyB = b.$set ? Object.keys(b.$set)[0] : Object.keys(b.$unset)[0];
            return keyA.localeCompare(keyB);
          });
        }
      }
    }

    // Apply fragment mods to get the final state.
    const finalConfig = applyFragmentMods(baseConfig);
    const metadata = extractConfigMetadata(lastChangeEntry);

    return {
      config: finalConfig,
      metadata,
    };
  } catch (error) {
    console.error("Error getting robot config at time:", error);
    return null;
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
  configTimestamp: Date,
  machineId: string
): void => {
  try {
    // Helper to pad numbers with a leading zero
    const pad = (num: number) => num.toString().padStart(2, '0');

    // Format using local time for user-friendliness
    const year = configTimestamp.getFullYear();
    const month = pad(configTimestamp.getMonth() + 1);
    const day = pad(configTimestamp.getDate());
    const hours = configTimestamp.getHours();
    const minutes = pad(configTimestamp.getMinutes());
    const seconds = pad(configTimestamp.getSeconds());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;

    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hours12}-${minutes}-${seconds}${ampm}`;
    const fileName = `config-${machineId.substring(0, 8)}-pass-${passId.substring(
      0,
      8
    )}-${dateStr}-${timeStr}.json`;

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

/**
 * Applies a single modification to the configuration object.
 * This is a simplified implementation and may need to be expanded
 * to handle all pathing cases (e.g., finding components by name).
 */
const applyMod = (config: RobotConfig, path: string, value: any): void => {
  const keys = path.split('.');
  let current = config;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];

    // Handle array pathing like "components[name=my-component]"
    const arrayMatch = key.match(/([^.[]+)\[(\w+)=(.+)\]/);
    if (arrayMatch) {
      const arrayName = arrayMatch[1];
      const propName = arrayMatch[2];
      const propValue = arrayMatch[3];
      if (current[arrayName] && Array.isArray(current[arrayName])) {
        const foundItem = current[arrayName].find(
          (item: any) => item[propName] === propValue
        );
        if (foundItem) {
          current = foundItem;
          continue;
        }
      }
    }

    if (typeof current[key] === 'undefined') {
      // If path doesn't exist, create it.
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
};

/**
 * Applies a single $unset modification to the configuration object.
 */
const deleteMod = (config: RobotConfig, path: string): void => {
  const keys = path.split('.');
  let current = config;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const arrayMatch = key.match(/([^.[]+)\[(\w+)=(.+)\]/);
    if (arrayMatch) {
      const arrayName = arrayMatch[1];
      const propName = arrayMatch[2];
      const propValue = arrayMatch[3];
      if (current[arrayName] && Array.isArray(current[arrayName])) {
        const foundItem = current[arrayName].find(
          (item: any) => item[propName] === propValue
        );
        if (foundItem) {
          current = foundItem;
          continue;
        } else {
          // Path doesn't exist, so nothing to delete.
          return;
        }
      }
    }
    if (typeof current[key] === 'undefined') {
      // Path doesn't exist, so nothing to delete.
      return;
    }
    current = current[key];
  }

  // Handle deletion from an array if the parent is an array
  const lastKey = keys[keys.length - 1];
  const arrayMatch = lastKey.match(/([^.[]+)\[(\w+)=(.+)\]/);
  if (arrayMatch && Array.isArray(current)) {
    const propName = arrayMatch[2];
    const propValue = arrayMatch[3];
    const indexToDelete = current.findIndex(
      (item: any) => item[propName] === propValue
    );
    if (indexToDelete > -1) {
      current.splice(indexToDelete, 1);
    }
    return;
  }

  delete current[keys[keys.length - 1]];
};

/**
 * Merges fragment modifications into a base robot configuration.
 */
export const applyFragmentMods = (config: RobotConfig): RobotConfig => {
  if (!config.fragment_mods || !Array.isArray(config.fragment_mods)) {
    return config;
  }

  // Use a deep copy to avoid mutating the original object
  const newConfig = JSON.parse(JSON.stringify(config));

  for (const fragmentMod of newConfig.fragment_mods) {
    if (fragmentMod.mods && Array.isArray(fragmentMod.mods)) {
      for (const mod of fragmentMod.mods) {
        if (mod.$set) {
          for (const path in mod.$set) {
            applyMod(newConfig, path, mod.$set[path]);
          }
        } else if (mod.$unset) {
          for (const path in mod.$unset) {
            // The path for unsetting a component is 'components[name=motor]'
            // which needs to be handled by deleteMod directly.
            deleteMod(newConfig, path);
          }
        }
      }
    }
  }
  delete newConfig.fragment_mods;
  delete newConfig.fragments;
  return newConfig;
};
