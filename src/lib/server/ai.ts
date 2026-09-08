import { ApiError } from './auth';

export type ProposedTask = {
  title: string;
  description: string;
  priority: 'none' | 'low' | 'medium' | 'high';
  suggestedColumn: string;
};

export type GenerateTasksResult = {
  summary: string;
  tasks: ProposedTask[];
  modelUsed: string;
};

export async function generateTasksWithGemini({
  prompt,
  apiKey: userApiKey,
  boardColumns = []
}: {
  prompt: string;
  apiKey?: string;
  boardColumns?: Array<{ id: string; name: string }>;
}): Promise<GenerateTasksResult> {
  const key = (userApiKey || '').trim() || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    throw new ApiError(
      400,
      'API key is required. Please provide an API key in settings or set it in your environment.'
    );
  }

  const models = Array.from(
    new Set([
      process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ])
  );

  const columnGuide = boardColumns.length > 0
    ? boardColumns.map(c => `"${c.id}" (${c.name})`).join(', ')
    : '"todo" (To do), "doing" (In progress), "done" (Done)';

  const systemPrompt = `You are an expert project management assistant for TaskBoard.
Analyze the user's input, which may be in plain English or any other language (or a voice speech transcript).
Decompose the project, idea, or notes into a clean list of 3 to 12 concise, actionable tasks.
For each task:
- "title": Short, actionable title (under 100 chars, starting with an action verb). Match the user's language or use clear English.
- "description": Helpful context, sub-steps, or acceptance criteria (under 500 chars).
- "priority": Exactly one of "high", "medium", "low", or "none".
- "suggestedColumn": Suggest one of the board's column IDs: ${columnGuide}. Default to the first column if unsure.

Respond strictly with a valid JSON object matching:
{
  "summary": "Brief 1-sentence overview of the task plan",
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "priority": "high" | "medium" | "low" | "none",
      "suggestedColumn": "string"
    }
  ]
}`;

  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        // If model not found (404), continue to next model fallback
        if (response.status === 404 || errText.includes('NOT_FOUND') || errText.includes('is not found')) {
          lastError = new Error(`Model ${model} not available (${response.status})`);
          continue;
        }
        if (response.status === 400 && (errText.includes('API_KEY_INVALID') || errText.includes('invalid API key'))) {
          throw new ApiError(400, 'Invalid API key. Please check the key provided.');
        }
        if (response.status === 429) {
          throw new ApiError(429, 'Rate limit reached. Please wait a moment and try again.');
        }
        throw new ApiError(response.status, `AI service error: ${response.statusText}`);
      }

      const json = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Empty response from AI service');
      }

      const parsed = JSON.parse(rawText);
      const tasks: ProposedTask[] = (Array.isArray(parsed?.tasks) ? parsed.tasks : []).map((t: Record<string, unknown>) => {
        const priorityVal = String(t.priority || 'none').toLowerCase();
        const validPriority: 'none' | 'low' | 'medium' | 'high' =
          ['none', 'low', 'medium', 'high'].includes(priorityVal)
            ? (priorityVal as 'none' | 'low' | 'medium' | 'high')
            : 'none';

        const suggestedCol = typeof t.suggestedColumn === 'string' && t.suggestedColumn.trim()
          ? t.suggestedColumn.trim()
          : (boardColumns[0]?.id || 'todo');

        return {
          title: String(t.title || 'Untitled task').slice(0, 100),
          description: String(t.description || '').slice(0, 1000),
          priority: validPriority,
          suggestedColumn: suggestedCol
        };
      });

      return {
        summary: String(parsed?.summary || 'Proposed tasks based on your request.'),
        tasks,
        modelUsed: model
      };
    } catch (e) {
      if (e instanceof ApiError) throw e;
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw new ApiError(
    502,
    `Failed to generate tasks. ${lastError ? lastError.message : 'Please verify your API key or try again.'}`
  );
}
