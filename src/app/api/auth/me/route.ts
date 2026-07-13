import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/auth';
export async function GET(){ return NextResponse.json({authenticated: await isAdmin()}); }
