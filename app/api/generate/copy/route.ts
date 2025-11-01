import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const GenerateCopySchema = z.object({
  brief: z.string().min(1).max(1000),
  style: z.string().optional().default('professional'),
  targetAudience: z.string().optional().default('general'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brief, style, targetAudience } = GenerateCopySchema.parse(body);
    
    // Mock per ora - sistemeremo Groq dopo
    const generatedCopy = generateMockCopy(brief, style, targetAudience);
    
    return NextResponse.json({ 
      success: true, 
      copy: generatedCopy,
      quality_score: 7.5
    });
  } catch (error) {
    console.error('Copy generation error:', error);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}

function generateMockCopy(brief: string, style: string, audience: string): string {
  return `[HEADLINE] Copy for: ${brief}

[COPY] This is mock content for ${brief} with ${style} style targeting ${audience}.

[CTA] Contact us for more information!`;
}
