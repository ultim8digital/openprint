import { z } from 'zod';
import type { Profile, Currency } from './types.js';

export const manufacturingProcesses = [
  'FDM',
  'SLA',
  'SLS',
  'MJF',
  'DMLS',
  'LASER',
  'CNC',
  'CNC_TURNING',
  'WOOD_CNC',
  'WATERJET',
  'PLASMA',
  'SHEET_METAL',
  'MIXED',
  'UNSURE',
] as const;
export const studioPartSchema = z
  .object({
    kind: z.enum(['block', 'plate', 'tube']),
    width: z.number().min(4).max(300),
    depth: z.number().min(4).max(300),
    height: z.number().min(1).max(300),
    hole: z.number().min(0).max(296),
  })
  .strict();

/** The model proposes this data; the owner confirms it before any publication. */
export const studioBriefSchema = z
  .object({
    title: z.string().trim().min(5).max(120),
    purpose: z.string().trim().min(20).max(3000),
    requestKind: z.enum(['design', 'manufacture']),
    process: z.enum(manufacturingProcesses),
    material: z.string().trim().max(80),
    quantity: z.number().int().min(1).max(10000).nullable(),
    city: z.string().trim().max(80),
    part: studioPartSchema.nullable(),
    requirements: z.array(z.string().trim().min(1).max(300)).max(12),
    questions: z.array(z.string().trim().min(1).max(300)).max(6),
    assumptions: z.array(z.string().trim().min(1).max(300)).max(8),
    components: z
      .array(
        z
          .object({
            name: z.string().trim().min(2).max(100),
            quantity: z.number().int().min(1).max(10000).nullable(),
            process: z.enum(manufacturingProcesses),
            material: z.string().trim().max(80),
            requirements: z.string().trim().max(600),
          })
          .strict(),
      )
      .max(30),
    operations: z.array(z.string().trim().min(1).max(300)).max(20),
    acceptance: z.array(z.string().trim().min(1).max(300)).max(12),
  })
  .strict();
export type StudioBrief = z.infer<typeof studioBriefSchema>;
export const studioSaveSchema = z
  .object({
    version: z.number().int().min(1),
    brief: studioBriefSchema,
  })
  .strict();
export const studioCreateSchema = z
  .object({
    idea: z.string().trim().min(20).max(3000),
    language: z.enum(['ru', 'en']),
  })
  .strict();
export type StudioCheck = {
  code: string;
  level: 'passed' | 'attention' | 'required';
  ru: string;
  en: string;
};
export type StudioProject = {
  id: string;
  idea: string;
  language: 'ru' | 'en';
  brief: StudioBrief;
  version: number;
  confirmed_version: number | null;
  confirmed_hash: string | null;
  source: 'manual' | 'openai';
  job_id: string | null;
  created_at: number;
  updated_at: number;
  checks: StudioCheck[];
};
export type StudioMatch = {
  profile: Profile;
  score: number;
  reasons: string[];
};
export type StudioCapabilities = {
  ai: {
    configured: boolean;
    model: string;
    reviewModel: string;
    maxCallsPerProject: number;
    maxCallsPerUserDay: number;
    maxCallsPerInstanceDay: number;
    maxOutputTokens: number;
  };
  processes: { id: string; ru: string; en: string; status: 'template' | 'brief' }[];
};
export type StudioUsage = {
  projectCalls: number;
  inputTokens: number;
  outputTokens: number;
  runs: {
    id: string;
    model: string;
    status: string;
    created_at: number;
    input_tokens: number;
    output_tokens: number;
  }[];
};
export type StudioPublishInput = {
  version: number;
  visibility: 'public' | 'direct';
  target_profile_id: string | null;
  currency: Currency;
  budget: number | null;
};
