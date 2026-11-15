import { z } from 'zod';
import { cadSpecSchema, type CadSpec } from './cad.js';
import type { StudioUsage } from './studio.js';

/** A model result is a proposal, never a saved CAD revision or a manufacturing approval. */
export const cadProposalOutputSchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
    questions: z.array(z.string().trim().min(1).max(300)).max(8),
    spec: cadSpecSchema.nullable(),
  })
  .strict();
export type CadProposalOutput = z.infer<typeof cadProposalOutputSchema>;
export type CadProposal = {
  id: string;
  run_id: string;
  project_id: string;
  input_version: number;
  model: string;
  summary: string;
  questions: string[];
  spec: CadSpec | null;
  created_at: number;
  applied_version: number | null;
  stale: boolean;
};
export type CadProposalState = {
  proposals: CadProposal[];
  usage: StudioUsage;
  ai: { configured: boolean; model: string; maxCallsPerProject: number };
};
export const cadAssistSchema = z
  .object({
    version: z.number().int().positive(),
    requestId: z.string().uuid(),
    message: z.string().trim().min(1).max(2000),
    consent: z.literal(true),
  })
  .strict();
export const cadProposalApplySchema = z
  .object({
    version: z.number().int().positive(),
    reviewed: z.literal(true),
  })
  .strict();
