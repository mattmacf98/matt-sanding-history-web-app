import * as VIAM from "@viamrobotics/sdk";
import { PassNote, PassDiagnosis } from '../types';

const NOTE_PREFIX = 'note-';
const DIAGNOSIS_PREFIX = 'diagnosis-';

export class PassMetadataManager {
  private viamClient: VIAM.ViamClient;
  private machineId: string;
  private cachedNotes: Map<string, PassNote> | null = null;
  private cachedDiagnoses: Map<string, PassDiagnosis> | null = null;

  constructor(viamClient: VIAM.ViamClient, machineId: string) {
    this.viamClient = viamClient;
    this.machineId = machineId;
  }

  /**
   * Get all notes from metadata - stored as flat key-value pairs
   * Each note is stored as: "note-{passId}": "json-stringified-PassNote"
   */
  private async getNotesMetadata(): Promise<Map<string, PassNote>> {
    if (this.cachedNotes !== null) {
      return this.cachedNotes;
    }

    const metadata = await this.viamClient.appClient.getRobotMetadata(this.machineId);
    const notes = new Map<string, PassNote>();

    Object.keys(metadata).forEach(key => {
      if (key.startsWith(NOTE_PREFIX)) {
        const passId = key.substring(NOTE_PREFIX.length);
        try {
          const noteData = JSON.parse(metadata[key] as string);
          notes.set(passId, noteData as PassNote);
        } catch (e) {
          console.warn(`Failed to parse note for pass ${passId}:`, e);
        }
      }
    });

    this.cachedNotes = notes;

    return notes;
  }

  /**
   * Get all diagnoses from metadata - stored as flat key-value pairs
   * Each diagnosis is stored as: "diagnosis-{passId}": "json-stringified-PassDiagnosis"
   */
  private async getDiagnosesMetadata(): Promise<Map<string, PassDiagnosis>> {
    if (this.cachedDiagnoses !== null) {
      return this.cachedDiagnoses;
    }

    const metadata = await this.viamClient.appClient.getRobotMetadata(this.machineId);
    const diagnoses = new Map<string, PassDiagnosis>();

    Object.keys(metadata).forEach(key => {
      if (key.startsWith(DIAGNOSIS_PREFIX)) {
        const passId = key.substring(DIAGNOSIS_PREFIX.length);
        try {
          const diagnosisData = JSON.parse(metadata[key] as string);
          diagnoses.set(passId, diagnosisData as PassDiagnosis);
        } catch (e) {
          console.warn(`Failed to parse diagnosis for pass ${passId}:`, e);
        }
      }
    });

    this.cachedDiagnoses = diagnoses;

    // Log all loaded diagnoses
    console.log(`🔍 Loaded ${diagnoses.size} diagnoses from metadata:`);
    if (diagnoses.size > 0) {
      console.table(Array.from(diagnoses.entries()).map(([passId, diagnosis]) => ({
        passId,
        symptom: diagnosis.symptom || '(none)',
        cause: diagnosis.cause || '(none)',
        updatedAt: diagnosis.updated_at,
        updatedBy: diagnosis.updated_by
      })));
    }

    return diagnoses;
  }

  /**
   * Save all notes to metadata as flat key-value pairs
   * IMPORTANT: Merges with existing metadata to preserve other apps' data
   */
  private async saveNotesMetadata(notes: Map<string, PassNote>): Promise<void> {
    // Read current metadata to preserve non-note keys
    const currentMetadata = await this.viamClient.appClient.getRobotMetadata(this.machineId);

    // Remove old note keys (cleanup any deleted notes)
    Object.keys(currentMetadata).forEach(key => {
      if (key.startsWith(NOTE_PREFIX)) {
        delete currentMetadata[key];
      }
    });

    // Add all current notes
    notes.forEach((note, passId) => {
      currentMetadata[`${NOTE_PREFIX}${passId}`] = JSON.stringify(note);
    });

    // Save merged metadata (preserves other apps' keys)
    await this.viamClient.appClient.updateRobotMetadata(this.machineId, currentMetadata);

    // Update cache
    this.cachedNotes = notes;

    // Log all notes after save
    console.log(`💾 Saved ${notes.size} notes to metadata:`);
    if (notes.size > 0) {
      console.table(Array.from(notes.entries()).map(([passId, note]) => ({
        passId,
        noteText: note.note_text.substring(0, 50) + (note.note_text.length > 50 ? '...' : ''),
        createdAt: note.created_at,
        createdBy: note.created_by
      })));
    }
  }

  /**
   * Save a single diagnosis to metadata
   * Uses incremental update to avoid overwriting other metadata
   */
  private async saveSingleDiagnosis(passId: string, diagnosis: PassDiagnosis): Promise<void> {
    const currentMetadata = await this.viamClient.appClient.getRobotMetadata(this.machineId);
    currentMetadata[`${DIAGNOSIS_PREFIX}${passId}`] = JSON.stringify(diagnosis);
    await this.viamClient.appClient.updateRobotMetadata(this.machineId, currentMetadata);

    // Update cache
    if (this.cachedDiagnoses) {
      this.cachedDiagnoses.set(passId, diagnosis);
    }
  }

  /**
   * Save a note for a specific pass (replaces any existing note)
   * If noteText is empty, deletes the note instead
   */
  async savePassNote(passId: string, noteText: string): Promise<void> {
    console.log(`Saving note for pass ${passId}`);

    // If note text is empty, delete the note instead
    if (!noteText || noteText.trim() === '') {
      console.log('Note text is empty - deleting note instead');
      await this.deleteAllNotesForPass(passId);
      return;
    }

    const notes = await this.getNotesMetadata();

    const now = new Date();
    const note: PassNote = {
      pass_id: passId,
      note_text: noteText,
      created_at: now.toISOString(),
      created_by: "summary-web-app"
    };

    notes.set(passId, note);

    await this.saveNotesMetadata(notes);

    console.log("Note saved successfully!");
  }

  /**
   * Delete a note for a specific pass
   */
  async deleteAllNotesForPass(passId: string): Promise<void> {
    console.log(`Deleting note for pass ${passId}`);

    const notes = await this.getNotesMetadata();

    if (notes.has(passId)) {
      notes.delete(passId);
      await this.saveNotesMetadata(notes);
      console.log("Note deleted successfully!");
    } else {
      console.log("No note found for this pass");
    }
  }

  /**
   * Fetch notes for multiple passes
   * @param passIds - An array of pass IDs to fetch notes for
   * @returns A Promise that resolves to a map of all fetched notes
   */
  async fetchNotesForPasses(
    passIds: string[]
  ): Promise<Map<string, PassNote[]>> {
    console.log(`Fetching notes for ${passIds.length} passes`);

    const notes = await this.getNotesMetadata();
    const result = new Map<string, PassNote[]>();

    // Build result map - each pass has at most one note
    passIds.forEach(passId => {
      const note = notes.get(passId);
      if (note) {
        result.set(passId, [note]);
      }
    });

    console.log(`Found notes for ${result.size} passes`);
    return result;
  }

  /**
   * Save a diagnosis for a specific pass
   * If both symptom and cause are undefined/empty, deletes the diagnosis
   */
  async savePassDiagnosis(passId: string, symptom?: string, cause?: string): Promise<void> {
    console.log(`Saving diagnosis for pass ${passId}: symptom=${symptom}, cause=${cause}`);

    // If both are empty, delete the diagnosis
    if (!symptom && !cause) {
      console.log('Both symptom and cause are empty - deleting diagnosis');
      await this.deletePassDiagnosis(passId);
      return;
    }

    const now = new Date();
    const diagnosis: PassDiagnosis = {
      pass_id: passId,
      symptom: symptom as PassDiagnosis['symptom'],
      cause: cause as PassDiagnosis['cause'],
      updated_at: now.toISOString(),
      updated_by: "summary-web-app"
    };

    await this.saveSingleDiagnosis(passId, diagnosis);
    console.log("Diagnosis saved successfully!");
  }

  /**
   * Delete a diagnosis for a specific pass
   */
  async deletePassDiagnosis(passId: string): Promise<void> {
    console.log(`Deleting diagnosis for pass ${passId}`);

    const currentMetadata = await this.viamClient.appClient.getRobotMetadata(this.machineId);
    const key = `${DIAGNOSIS_PREFIX}${passId}`;

    if (key in currentMetadata) {
      delete currentMetadata[key];
      await this.viamClient.appClient.updateRobotMetadata(this.machineId, currentMetadata);

      // Update cache
      if (this.cachedDiagnoses) {
        this.cachedDiagnoses.delete(passId);
      }
      console.log("Diagnosis deleted successfully!");
    } else {
      console.log("No diagnosis found for this pass");
    }
  }

  /**
   * Fetch diagnoses for multiple passes
   * @param passIds - An array of pass IDs to fetch diagnoses for
   * @returns A Promise that resolves to a map of pass_id -> PassDiagnosis
   */
  async fetchDiagnosesForPasses(
    passIds: string[]
  ): Promise<Map<string, PassDiagnosis>> {
    console.log(`Fetching diagnoses for ${passIds.length} passes`);

    const diagnoses = await this.getDiagnosesMetadata();
    const result = new Map<string, PassDiagnosis>();

    // Build result map - only include passes that have diagnoses
    passIds.forEach(passId => {
      const diagnosis = diagnoses.get(passId);
      if (diagnosis) {
        result.set(passId, diagnosis);
      }
    });

    console.log(`Found diagnoses for ${result.size} passes`);
    return result;
  }
}

export function createPassMetadataManager(viamClient: VIAM.ViamClient, machineId: string): PassMetadataManager {
  return new PassMetadataManager(viamClient, machineId);
}
