export const AI_PROMPT = `You are selecting short vertical clips from a long video.

Analyze the attached transcript. Return 10 to 20 self-contained moments that can work as Shorts, Reels, or TikTok clips.

Selection criteria:
- an immediate hook or strong statement near the beginning;
- a complete idea with understandable context;
- emotional, surprising, useful, controversial, or memorable content;
- natural start and end boundaries;
- target duration 25 to 60 seconds;
- absolute allowed duration 15 to 90 seconds;
- avoid duplicate or heavily overlapping moments;
- use only words and absolute timestamps that exist in the transcript;
- do not invent words or timestamps.

For each clip include:
- title;
- exact start and end seconds from the transcript;
- hook score from 1 to 10;
- one-sentence reason;
- opening caption of at most 12 words;
- relevant transcript segment IDs.

Return valid JSON only. Follow clips.schema.json. Do not include Markdown fences or commentary.
`;
