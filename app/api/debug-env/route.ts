import { NextResponse } from 'next/server';

export async function GET() {
  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING', 
    GROQ_API_KEY: process.env.GROQ_API_KEY ? 'SET' : 'MISSING',
    BUDGET_CAP_EUR: process.env.BUDGET_CAP_EUR || 'MISSING',
  };

  return NextResponse.json(envVars);
}
