export type Lang = 'en' | 'zh';
export type Theme = 'light' | 'dark';
export type Protocol = 'execution' | 'qa';
export type CategoryId = 'GAS' | 'DDC' | 'ARC' | 'SPF' | 'CGM';

export interface ModelMeta {
  id: string;
  label: string;
  short: string;
  family: string;
  effort: string;
}

export interface EpisodeSummary {
  id: string;
  model_id: string;
  model_label: string;
  model_short: string;
  family: string;
  reasoning_effort: string;
  protocol: Protocol;
  category: CategoryId;
  task_id: string;
  seed: number;
  score: number;
  success: boolean;
  scored_success: boolean;
  hard_constraints_passed: boolean;
  rounds: number;
  steps: number;
  total_tokens: number;
  reasoning_tokens: number;
  wall_time_s: number;
  termination_reason: string;
  planning_failures: number;
  tool_errors: number;
  has_video: boolean;
  video_duration_s: number | null;
  bundled: boolean;
  tags: string[];
  errors: Record<string, number | null>;
  component_scores: Record<string, number>;
  hard_constraints: Record<string, Record<string, boolean>>;
  failure_reason: string | null;
  instruction: string;
}

export interface IndexPayload {
  schema_version: number;
  total_episodes: number;
  bundled_episodes: number;
  models: ModelMeta[];
  categories: Record<CategoryId, string[]>;
  tolerances: Record<string, number>;
  episodes: EpisodeSummary[];
}

export interface RoundImage {
  camera: string;
  path: string;
}

export interface ToolCallEntry {
  name: string;
  note: string | null;
  reason: string | null;
  targets: Record<string, number> | null;
  delta_targets: Record<string, number> | null;
  answers: Record<string, unknown> | null;
}

export interface PlanningEntry {
  arm: string;
  status: string;
}

export interface ToolFeedbackEntry {
  status: string;
  message: string;
}

export interface TimelineRound {
  round: number;
  time_s: number;
  start_step: number;
  end_step: number;
  executed_steps: number;
  images: RoundImage[];
  after_images: RoundImage[];
  tcp_state: Record<string, number>;
  reasoning: string | null;
  reasoning_kind: string | null;
  message: string | null;
  tool_calls: ToolCallEntry[];
  planning: PlanningEntry[];
  tool_feedback: ToolFeedbackEntry[];
  status: string;
  has_error: boolean;
  state_prompt: string;
}

export interface TimelineDocument {
  id: string;
  model_id: string;
  model_label: string;
  reasoning_effort: string;
  protocol: Protocol;
  category: CategoryId;
  task_id: string;
  seed: number;
  robot: string;
  instruction: string;
  control_dt_s: number;
  score: number;
  success: boolean;
  scored_success: boolean;
  hard_constraints_passed: boolean;
  hard_constraints: Record<string, Record<string, boolean>>;
  metrics: Record<string, number | string | boolean | null>;
  errors: Record<string, number | null>;
  component_scores: Record<string, number>;
  failure_reason: string | null;
  termination_reason: string;
  steps: number;
  verification_steps: number;
  wall_time_s: number;
  tokens: {
    input: number;
    cached_input: number;
    output: number;
    reasoning: number;
    total: number;
  };
  video: string | null;
  poster: string | null;
  video_duration_s: number | null;
  system_prompt: string;
  tools: Array<{ name: string; description: string }>;
  rounds: TimelineRound[];
}

export type PageRoute =
  | { page: 'home' }
  | { page: 'leaderboard'; tab?: 'main' | 'matrix' | 'cross-platform' }
  | { page: 'explorer'; query: URLSearchParams }
  | {
      page: 'trajectory';
      modelId: string;
      protocol: Protocol;
      taskId: string;
      seed: number;
      round?: number;
    };
