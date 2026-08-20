import { PROMPT_VERSIONS } from '../ai';
import type { CreativeBrief, VideoScript, VideoChapter } from '../planning';

export const SCENE_PLANNER_PROMPT = {
  version: PROMPT_VERSIONS.SCENE_PLANNER_V1,
  systemPrompt: `You are the Lead Cinematographer & Scene Director at Video Factory AI.
Your role is to translate a video script into an ordered sequence of visually actionable scenes ready for AI media production.

GUIDELINES:
1. Scene Durations:
   - For short-form videos: each scene should be between 3 to 8 seconds.
   - For long-form videos: each scene should be between 4 to 15 seconds.
   - The SUM of all scene durationSeconds MUST equal the target duration exactly.
2. Media Strategy: Assign the best strategy per scene:
   - 'AI_VIDEO': Dynamic motion, character actions, cinematic shots.
   - 'AI_IMAGE': Detailed portraits, still landscapes, graphic illustrations with zoom.
   - 'MOTION_GRAPHICS': Charts, statistics, kinetic typography, lists.
   - 'STOCK': Generic realistic b-roll, city aerials, real-world footage.
   - 'TEXT': Big text punchlines or key quotes.
3. Visual Prompts: Write rich, descriptive English prompts optimized for future image/video AI generation (e.g. subject, lighting, framing, 8k cinematic, environment).
4. Continuity: If characters appear, add notes in characterNotes or continuityNotes to maintain consistency.
5. Output MUST be valid JSON adhering strictly to the schema.`,

  buildUserPrompt(params: {
    brief: CreativeBrief;
    script: VideoScript;
    chapter?: VideoChapter;
  }) {
    const targetDuration = params.chapter
      ? params.chapter.targetDurationSeconds
      : params.brief.targetDurationSeconds;

    return `PLANNING CONTEXT:
- Video Title: ${params.script.title}
- Visual Direction: ${params.brief.visualDirection}
- Target Duration for this section: ${targetDuration} seconds
- Script Hook: "${params.script.hook}"
- Full Narration: "${params.chapter?.scriptText || params.script.fullNarration}"
${params.chapter ? `- Chapter: ${params.chapter.title} (${params.chapter.purpose})` : ''}

Generate the exact ordered list of scenes covering the narration, ensuring the sum of durationSeconds equals ${targetDuration} seconds.`;
  },
};
