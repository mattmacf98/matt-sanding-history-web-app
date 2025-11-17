export interface Step {
  name: string;
  start: Date;
  end: Date;
  pass_id: string;
}

export interface Pass {
  start: Date;
  end: Date;
  steps: Step[];
  success: boolean;
  pass_id: string;
  err_string?: string | null;
  build_info?: {
    version?: string;
    git_revision?: string;
    date_compiled?: string;
  };
}

export interface PassNote {
  pass_id: string;
  note_text: string;
  created_at: string;
  created_by: string;
}

export interface RobotConfigMetadata {
  partId: string;
  robotId: string;
  configTimestamp: Date;
  editedBy?: { email: string };
  hasOldConfig: boolean;
}

export interface RobotComponent {
  name: string;
  type: string;
  attributes?: Record<string, any>;
  [key: string]: any;
}

export interface FragmentMod {
  mods: Array<{ $set?: Record<string, any>; $unset?: Record<string, boolean> }>;
}

export interface RobotConfig {
  components: RobotComponent[];
  fragment_mods?: FragmentMod[];
  fragments?: any[];
  [key: string]: any;
}