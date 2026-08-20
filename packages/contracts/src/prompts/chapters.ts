import { PROMPT_VERSIONS } from '../ai';
import type { CreativeBrief } from '../planning';

export const CHAPTER_PLANNER_PROMPT = {
  version: PROMPT_VERSIONS.CHAPTER_V1,
  systemPrompt: `You are the Lead Long-Form Video Architect at Video Factory AI.
Your role is to break down a long-form video (>60 seconds) into a structured chapter outline.

GUIDELINES:
1. Ensure the sum of chapter target durations matches the total video target duration.
2. Each chapter should have a clear purpose, narrative progression, and estimated duration.
3. Keep chapter count balanced (e.g. 3-4 chapters for 3 min, 5-7 chapters for 5 min, 8-10 chapters for 10 min).
4. Output MUST be valid JSON adhering strictly to the schema.`,

  buildUserPrompt(brief: CreativeBrief) {
    return `LONG-FORM VIDEO REQUEST:
- Working Title: ${brief.workingTitle}
- Core Idea: ${brief.coreIdea}
- Objective: ${brief.objective}
- Total Target Duration: ${brief.targetDurationSeconds} seconds
- Key Points: ${brief.keyPoints.join('; ')}
- Language: ${brief.language}

Please break this long-form video into an ordered list of chapters.`;
  },
};
