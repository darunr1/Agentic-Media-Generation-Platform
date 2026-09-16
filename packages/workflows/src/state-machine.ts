export const CONTENT_STATES = [
  "DRAFT",
  "PLANNING",
  "SCRIPTING",
  "ASSET_GENERATION",
  "VOICE_GENERATION",
  "CAPTION_GENERATION",
  "RENDERING",
  "AWAITING_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "PARTIALLY_PUBLISHED",
  "FAILED",
  "CANCELLED",
] as const;
export type ContentWorkflowState = (typeof CONTENT_STATES)[number];
const TRANSITIONS: Record<ContentWorkflowState, readonly ContentWorkflowState[]> = {
  DRAFT: ["PLANNING", "CANCELLED"],
  PLANNING: ["SCRIPTING", "FAILED", "CANCELLED"],
  SCRIPTING: ["ASSET_GENERATION", "FAILED", "CANCELLED"],
  ASSET_GENERATION: ["VOICE_GENERATION", "FAILED", "CANCELLED"],
  VOICE_GENERATION: ["CAPTION_GENERATION", "FAILED", "CANCELLED"],
  CAPTION_GENERATION: ["RENDERING", "FAILED", "CANCELLED"],
  RENDERING: ["AWAITING_REVIEW", "FAILED", "CANCELLED"],
  AWAITING_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "CANCELLED"],
  CHANGES_REQUESTED: ["SCRIPTING", "AWAITING_REVIEW", "CANCELLED"],
  APPROVED: ["SCHEDULED", "PUBLISHING", "CANCELLED"],
  SCHEDULED: ["PUBLISHING", "CANCELLED"],
  PUBLISHING: ["PUBLISHED", "PARTIALLY_PUBLISHED", "FAILED"],
  PUBLISHED: [],
  PARTIALLY_PUBLISHED: ["PUBLISHING"],
  FAILED: [
    "PLANNING",
    "SCRIPTING",
    "ASSET_GENERATION",
    "VOICE_GENERATION",
    "CAPTION_GENERATION",
    "RENDERING",
    "PUBLISHING",
    "CANCELLED",
  ],
  CANCELLED: [],
};
export function canTransition(from: ContentWorkflowState, to: ContentWorkflowState): boolean {
  return TRANSITIONS[from].includes(to);
}
export function assertTransition(from: ContentWorkflowState, to: ContentWorkflowState): void {
  if (!canTransition(from, to)) throw new Error(`Invalid workflow transition: ${from} -> ${to}`);
}
