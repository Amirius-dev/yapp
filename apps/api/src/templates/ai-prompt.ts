export const AI_PROMPT = `You are selecting short vertical clips from a long source video.

Analyze the entire attached transcript, not only adjacent segments. Return 10 to 20 self-contained moments suitable for Shorts, Reels, or TikTok.

This package uses schemaVersion 2. A Short may contain either:
- one continuous range when that fragment already tells a complete story; or
- several non-adjacent ranges when they genuinely strengthen one coherent story.

For example, ranges 10–18, 240–252, and 500–510 may be combined in that order when their spoken content forms one natural narrative. Do not force multiple ranges into every clip. Prefer one range whenever a continuous passage is already strong.

Rules for ranges:
- every range must contain a natural phrase or a complete part of speech;
- never cut speech into isolated words or arbitrarily reorder individual words;
- order ranges so the resulting story sounds clear and natural;
- use only exact absolute timestamps and segment IDs present in transcript.json;
- never invent text, segment IDs, or timestamps;
- avoid repeated material and excessive jump cuts;
- avoid duplicate or heavily overlapping clip suggestions;
- the SUM of all range durations must be 15–90 seconds, preferably 25–60 seconds.

Selection criteria:
- a strong hook near the beginning of the finished Short;
- a complete idea with enough context and a clear ending;
- emotional, surprising, useful, controversial, or memorable content;
- natural sentence boundaries.

For each clip include exactly:
- title;
- one or more ranges with start, end, and relevant segmentIds;
- integer hookScore from 1 to 10;
- one-sentence reason;
- openingCaption of at most 12 words.

Single-range example:
{"title":"One complete idea","ranges":[{"start":42.5,"end":78.2,"segmentIds":[8,9,10]}],"hookScore":9,"reason":"A complete argument with a strong opening.","openingCaption":"The mistake nobody notices"}

Three-range example:
{"title":"One story from three moments","ranges":[{"start":10,"end":18,"segmentIds":[2]},{"start":240,"end":252,"segmentIds":[44,45]},{"start":500,"end":510,"segmentIds":[91,92]}],"hookScore":8,"reason":"The setup, evidence, and conclusion form one natural story.","openingCaption":"Three moments changed everything"}

Return only one valid JSON object that follows clips.schema.json. Do not use Markdown fences and do not add commentary before or after the JSON.
`;
