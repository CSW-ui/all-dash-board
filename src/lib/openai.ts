/**
 * OpenAI API 유틸리티
 */

const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const res = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4000,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI API 실패: ${res.status} ${text}`)
  }

  const json = await res.json()
  return json.choices?.[0]?.message?.content ?? ''
}
