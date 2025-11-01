import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CarouselRequestSchema = z.object({
  slides: z.array(z.object({
    headline: z.string(),
    description: z.string(),
    backgroundColor: z.string().optional().default('#3b82f6'),
    textColor: z.string().optional().default('#ffffff'),
  })),
  format: z.enum(['png', 'pdf']).default('png'),
});

interface Slide {
  headline: string;
  description: string;
  backgroundColor: string;
  textColor: string;
}

interface CarouselAsset {
  slide: number;
  url: string;
  content: Slide;
  format: string;
  status: string;
  dimensions: { width: number; height: number };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slides, format } = CarouselRequestSchema.parse(body);
    
    const carouselAssets = await generateCarousel(slides, format);
    
    return NextResponse.json({ 
      success: true, 
      assets: carouselAssets 
    });
  } catch (error) {
    console.error('Carousel generation error:', error);
    return NextResponse.json({ error: 'Carousel generation failed' }, { status: 500 });
  }
}

async function generateCarousel(slides: Slide[], format: string): Promise<CarouselAsset[]> {
  // Per ora manteniamo il mock, implementeremo Satori nel prossimo step
  return slides.map((slide, index) => ({
    slide: index + 1,
    url: `https://via.placeholder.com/1200x630/${slide.backgroundColor.replace('#', '')}/${slide.textColor.replace('#', '')}?text=${encodeURIComponent(slide.headline)}`,
    content: slide,
    format: format,
    status: 'generated_placeholder',
    dimensions: { width: 1200, height: 630 }
  }));
}
