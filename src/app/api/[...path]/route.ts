import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError, authenticate, throttle } from '@/lib/server/auth';
import { dispatch } from '@/lib/server/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const user = await authenticate(request); await throttle(user.uid);
    if (Number(request.headers.get('content-length')) > 120000) throw new ApiError(413, 'Request is too large.');
    const raw = request.method === 'GET' ? '' : await request.text();
    if (raw.length > 120000) throw new ApiError(413, 'Request is too large.');
    let input: unknown = {};
    try { if (raw) input = JSON.parse(raw); } catch { throw new ApiError(400, 'Invalid JSON request.'); }
    const result = await dispatch(user, request.method, (await context.params).path, input);
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid input.' }, { status: 400, headers });
    console.error('TaskBoard API failure', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'The change could not be saved. Please try again.' }, { status: 503, headers });
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
