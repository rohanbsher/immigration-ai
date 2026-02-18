import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchJobAware } from './job-aware-fetch';

// Mock fetchWithTimeout
vi.mock('./fetch-with-timeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from './fetch-with-timeout';

const mockFetch = vi.mocked(fetchWithTimeout);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetchJobAware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes through a 200 response unchanged', async () => {
    const data = { caseId: '123', recommendations: [] };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    const result = await fetchJobAware('/api/cases/123/recommendations');
    expect(result).toEqual(data);
  });

  it('unwraps envelope format on 200', async () => {
    const inner = { caseId: '123', score: 0.85 };
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, data: inner }));

    const result = await fetchJobAware('/api/cases/123/success-score');
    expect(result).toEqual(inner);
  });

  it('throws on envelope error', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: false, error: 'Quota exceeded' }));

    await expect(fetchJobAware('/api/test')).rejects.toThrow('Quota exceeded');
  });

  it('throws on non-ok, non-202 responses', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(fetchJobAware('/api/cases/999/recommendations')).rejects.toThrow('Not Found');
  });

  it('polls until job completes on 202 response', async () => {
    // Initial request returns 202 with jobId
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ jobId: 'job-1', status: 'queued', message: 'Processing' }, 202)
    );

    // First poll: still active
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-1', status: 'active', progress: 50 })
    );

    // Second poll: completed
    const finalResult = { caseId: '123', recommendations: [{ id: 'rec1' }] };
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-1', status: 'completed', result: finalResult })
    );

    const result = await fetchJobAware('/api/cases/123/recommendations');
    expect(result).toEqual(finalResult);
  });

  it('throws when polled job fails', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ jobId: 'job-2', status: 'queued' }, 202)
    );

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-2', status: 'failed', error: 'AI service unavailable' })
    );

    await expect(fetchJobAware('/api/test')).rejects.toThrow('AI service unavailable');
  });

  it('handles envelope-wrapped 202 response', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ data: { jobId: 'job-3', status: 'queued' } }, 202)
    );

    const finalResult = { score: 0.9 };
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-3', status: 'completed', result: finalResult })
    );

    const result = await fetchJobAware('/api/test');
    expect(result).toEqual(finalResult);
  });

  it('invokes progress callback during polling', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ jobId: 'job-4', status: 'queued' }, 202)
    );

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-4', status: 'active', progress: 40 })
    );

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-4', status: 'active', progress: 80 })
    );

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: 'job-4', status: 'completed', progress: 100, result: { done: true } })
    );

    const onProgress = vi.fn();
    await fetchJobAware('/api/test', undefined, onProgress);

    expect(onProgress).toHaveBeenCalledWith(40);
    expect(onProgress).toHaveBeenCalledWith(80);
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it('throws on poll timeout', async () => {
    // Override the module's MAX_POLL_DURATION_MS for this test by making
    // the poll always see elapsed time > max. We mock Date.now() to jump.
    const realDateNow = Date.now;
    let callCount = 0;

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ jobId: 'job-slow', status: 'queued' }, 202)
    );

    // After the initial request, mock Date.now to return a time far in the future
    // so the while loop condition fails immediately
    vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      // First call is the startTime assignment, second is the while condition check
      if (callCount <= 1) return realDateNow();
      // Return a time 6 minutes in the future (past 5 min max)
      return realDateNow() + 6 * 60 * 1000;
    });

    await expect(fetchJobAware('/api/test')).rejects.toThrow('Job timed out');
  });

  it('handles envelope-wrapped polling response', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ jobId: 'job-5', status: 'queued' }, 202)
    );

    // Poll returns envelope-wrapped status
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ data: { id: 'job-5', status: 'completed', result: { ok: true } } })
    );

    const result = await fetchJobAware('/api/test');
    expect(result).toEqual({ ok: true });
  });
});
