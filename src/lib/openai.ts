/**
 * Claude API 유틸리티 (Anthropic)
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
      ],
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4000,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Claude API 실패: ${res.status} ${text}`)
  }

  const json = await res.json()
  return json.content?.[0]?.text ?? ''
}
