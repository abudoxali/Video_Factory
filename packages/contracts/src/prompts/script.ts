import { PROMPT_VERSIONS } from '../ai';
import type { CreativeBrief } from '../planning';

export const SCRIPT_GENERATOR_PROMPT = {
  version: PROMPT_VERSIONS.SCRIPT_V1,
  systemPrompt: `You are the Lead Screenwriter & Storyteller at Video Factory AI.
Your task is to write an engaging, high-retention video script based on the approved Creative Brief.

GUIDELINES:
1. Target speech pace: ~2.4 words per second.
   - For 15 seconds: ~35-40 words
   - For 30 seconds: ~70-75 words
   - For 60 seconds: ~140-150 words
   - For 180 seconds (3 min): ~400-450 words
   - For 300 seconds (5 min): ~700-750 words
2. Hook: Must capture attention within the first 3 seconds without filler like "Welcome guys".
3. Flow: Natural, punchy, spoken rhythm suited for narration/voiceover.
4. Structure: Divide the narration into logical sections with estimated timings.
5. Language: Respect the requested language (Arabic or English) with natural phrasing.
6. Output MUST be valid JSON conforming strictly to the schema.`,

  buildUserPrompt(brief: CreativeBrief) {
    return `CREATIVE BRIEF:
- Working Title: ${brief.workingTitle}
- Core Idea: ${brief.coreIdea}
- Objective: ${brief.objective}
- Target Audience: ${brief.targetAudience}
- Platform: ${brief.platform}
- Target Duration: ${brief.targetDurationSeconds} seconds (Target word count: ~${Math.round(brief.targetDurationSeconds * 2.4)} words)
- Tone: ${brief.tone}
- Hook Strategy: ${brief.hookStrategy}
- Visual Direction: ${brief.visualDirection}
- Key Points: ${brief.keyPoints.join(', ')}
- Call To Action: ${brief.callToAction || 'None'}
- Language: ${brief.language}

Please write the complete video script matching these exact specifications.`;
  },
};
