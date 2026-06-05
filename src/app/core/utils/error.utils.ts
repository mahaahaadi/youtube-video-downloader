import { HttpErrorResponse } from '@angular/common/http';

export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error;

    if (typeof body === 'object' && body && 'error' in body && typeof body.error === 'string') {
      return sanitizeYtdlpError(body.error);
    }

    if (typeof body === 'string' && body.trim()) {
      return sanitizeYtdlpError(body);
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function sanitizeYtdlpError(message: string): string {
  const cleaned = message
    .replace(/^ERROR:\s*/i, '')
    .replace(/^\[youtube\]\s*[\w-]+:\s*/i, '')
    .trim();

  if (/video unavailable/i.test(cleaned)) {
    return 'This video is unavailable. It may be private, deleted, or region-restricted. Try another link.';
  }

  if (/sign in to confirm your age/i.test(cleaned)) {
    return 'This video is age-restricted and cannot be analyzed without authentication.';
  }

  return cleaned || 'Unable to analyze this video. Please try another URL.';
}
