import { NextRequest, NextResponse } from 'next/server'

// Stub for Claude API integration
// Replace with actual Anthropic SDK call when ready:
// import Anthropic from '@anthropic-ai/sdk'
// const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { prompt, type, tone, length } = await req.json()

  // TODO: Replace with actual Claude API call
  // const message = await client.messages.create({
  //   model: 'claude-sonnet-4-6',
  //   max_tokens: 1024,
  //   messages: [{ role: 'user', content: buildPrompt(prompt, type, tone, length) }],
  // })

  return NextResponse.json({
    content: `[Claude API stub] Type: ${type}, Tone: ${tone}, Length: ${length}\n\n${prompt}에 대한 생성 결과가 여기에 표시됩니다.`,
  })
}
