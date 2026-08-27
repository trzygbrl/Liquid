/**
 * Speech Recognition Cross-Device Utilities
 *
 * Provides bulletproof speech transcript parsing, overlap removal, phrase deduplication,
 * and device-adaptive configurations to resolve the notorious Android Chrome/mobile web
 * speech recognition duplicate words bug (Chromium Issue 536644) and mobile latency.
 */

export interface SpeechResultItem {
  0?: { transcript?: string; confidence?: number };
  isFinal?: boolean;
  length?: number;
}

export type SpeechResultListLike = ArrayLike<SpeechResultItem>;

/**
 * Detects whether the current environment is a mobile or tablet browser
 * (Android, iOS, iPadOS) where continuous mode is prone to audio lag and
 * duplicate results.
 */
export function isMobileBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || '';
  const isTouch = navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  // iPadOS 13+ reports as Macintosh but has touch points
  const isIPad = /Macintosh/i.test(ua) && isTouch;

  return Boolean(isMobileUA || isIPad);
}

/**
 * Safely resolves the SpeechRecognition constructor across vendor prefixes.
 */
export function getSpeechRecognitionConstructor(): any {
  if (typeof window === 'undefined') return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

/**
 * Appends `nextText` to `prevText`, removing any overlap at the boundary.
 *
 * Handles:
 * 1. Exact duplicates ("headache" + "headache" -> "headache")
 * 2. Android Chrome cumulative sentence bug where nextText contains the entire prevText:
 *    ("masakit ang ulo" + "masakit ang ulo at lagnat" -> "masakit ang ulo at lagnat")
 * 3. Boundary word overlap:
 *    ("I have fever and" + "fever and headache" -> "I have fever and headache")
 * 4. Normal continuation with proper spacing and punctuation preservation.
 */
export function appendWithOverlapRemoval(prevText: string, nextText: string): string {
  const prev = prevText.trim();
  const next = nextText.trim();

  if (!prev) return next;
  if (!next) return prev;

  const prevLower = prev.toLowerCase();
  const nextLower = next.toLowerCase();

  // 1. If next is completely identical to prev
  if (prevLower === nextLower) {
    return prev;
  }

  // 2. Android Chrome cumulative bug: next starts with prev
  if (nextLower.startsWith(prevLower)) {
    // Preserve any trailing punctuation from prev if next doesn't have it
    return next;
  }

  // 3. Reverse: prev already ends with next
  if (prevLower.endsWith(nextLower)) {
    return prev;
  }

  // 4. Word-level boundary overlap removal
  const prevWords = prev.split(/\s+/);
  const nextWords = next.split(/\s+/);

  const maxOverlapWords = Math.min(prevWords.length, nextWords.length);
  let bestOverlap = 0;

  for (let overlap = maxOverlapWords; overlap > 0; overlap--) {
    const prevSlice = prevWords
      .slice(prevWords.length - overlap)
      .map((w) => w.toLowerCase())
      .join(' ');
    const nextSlice = nextWords
      .slice(0, overlap)
      .map((w) => w.toLowerCase())
      .join(' ');

    if (prevSlice === nextSlice) {
      bestOverlap = overlap;
      break;
    }
  }

  if (bestOverlap > 0) {
    const nonOverlappingNext = nextWords.slice(bestOverlap).join(' ');
    return nonOverlappingNext ? `${prev} ${nonOverlappingNext}` : prev;
  }

  // No overlap found, concatenate with space
  return `${prev} ${next}`;
}

/**
 * Removes accidental consecutive identical single words or multi-word repeated phrases.
 *
 * Example:
 * - "lagnat lagnat" -> "lagnat"
 * - "masakit ang ulo masakit ang ulo" -> "masakit ang ulo"
 */
export function deduplicatePhrases(text: string): string {
  if (!text) return '';

  // 1. Remove consecutive identical single words: "fever fever" -> "fever"
  const words = text.trim().split(/\s+/);
  const dedupedWords: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (
      i > 0 &&
      words[i].toLowerCase() === words[i - 1].toLowerCase() &&
      // Don't accidentally strip intentional Tagalog reduplications like "iba-iba" or "sama-sama"
      // unless it's a standalone duplicated token
      words[i].length > 1
    ) {
      continue;
    }
    dedupedWords.push(words[i]);
  }

  let cleaned = dedupedWords.join(' ');

  // 2. Remove consecutive identical multi-word phrases (from 8 words down to 2 words)
  for (let phraseLen = 8; phraseLen >= 2; phraseLen--) {
    const w = cleaned.split(/\s+/);
    if (w.length < phraseLen * 2) continue;

    let modified = false;
    const newWords: string[] = [];
    let i = 0;
    while (i < w.length) {
      if (i + phraseLen * 2 <= w.length) {
        const phrase1 = w
          .slice(i, i + phraseLen)
          .map((x) => x.toLowerCase())
          .join(' ');
        const phrase2 = w
          .slice(i + phraseLen, i + phraseLen * 2)
          .map((x) => x.toLowerCase())
          .join(' ');

        if (phrase1 === phrase2) {
          // Skip the duplicate phrase
          for (let k = 0; k < phraseLen; k++) {
            newWords.push(w[i + k]);
          }
          i += phraseLen * 2;
          modified = true;
          continue;
        }
      }
      newWords.push(w[i]);
      i++;
    }
    if (modified) {
      cleaned = newWords.join(' ');
    }
  }

  return cleaned.trim();
}

/**
 * Merges an array of text chunks, eliminating duplicate or overlapping phrases.
 */
export function mergeTextChunks(chunks: string[]): string {
  if (chunks.length === 0) return '';
  let result = chunks[0].trim();

  for (let i = 1; i < chunks.length; i++) {
    const next = chunks[i].trim();
    if (!next) continue;
    result = appendWithOverlapRemoval(result, next);
  }

  return result.trim();
}

/**
 * Cleans, deduplicates, and merges speech recognition results into a single string.
 * Integrates smoothly with optional `baseText` (e.g. existing text in textarea).
 */
export function cleanAndMergeSpeechResults(
  results: SpeechResultListLike,
  baseText: string = ''
): string {
  const finalizedChunks: string[] = [];
  let interimChunk = '';

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    const transcript = item?.[0]?.transcript?.trim() || '';
    if (!transcript) continue;

    if (item.isFinal) {
      finalizedChunks.push(transcript);
    } else {
      interimChunk = transcript;
    }
  }

  // Merge all finalized segments
  const mergedFinal = mergeTextChunks(finalizedChunks);

  // Merge with interim segment (if any)
  let sessionText = mergedFinal;
  if (interimChunk) {
    sessionText = appendWithOverlapRemoval(mergedFinal, interimChunk);
  }

  sessionText = deduplicatePhrases(sessionText);

  // Merge with base text if present
  if (baseText && baseText.trim()) {
    return appendWithOverlapRemoval(baseText.trim(), sessionText);
  }

  return sessionText;
}

/**
 * Creates an animation-frame / interval throttler to prevent React re-render thrashing
 * during rapid speech recognition interim events.
 */
export function createSpeechThrottler<T extends (...args: any[]) => void>(
  callback: T,
  minIntervalMs: number = 60
): {
  schedule: (...args: Parameters<T>) => void;
  flush: (...args: Parameters<T>) => void;
  cancel: () => void;
} {
  let timerId: any = null;
  let rafId: any = null;
  let lastExecTime = 0;
  let pendingArgs: Parameters<T> | null = null;

  const cancel = () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (rafId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pendingArgs = null;
  };

  const execute = () => {
    timerId = null;
    rafId = null;
    if (pendingArgs) {
      const args = pendingArgs;
      pendingArgs = null;
      lastExecTime = Date.now();
      callback(...args);
    }
  };

  const schedule = (...args: Parameters<T>) => {
    pendingArgs = args;
    const now = Date.now();
    const elapsed = now - lastExecTime;

    if (typeof requestAnimationFrame !== 'undefined') {
      if (elapsed >= minIntervalMs) {
        if (!rafId) {
          rafId = requestAnimationFrame(execute);
        }
      } else if (!timerId) {
        timerId = setTimeout(() => {
          if (!rafId) {
            rafId = requestAnimationFrame(execute);
          }
        }, minIntervalMs - elapsed);
      }
    } else {
      // Fallback for non-browser/test environments without requestAnimationFrame
      if (!timerId) {
        const delay = Math.max(10, minIntervalMs - elapsed);
        timerId = setTimeout(execute, delay);
      }
    }
  };

  const flush = (...args: Parameters<T>) => {
    cancel();
    lastExecTime = Date.now();
    callback(...args);
  };

  return { schedule, flush, cancel };
}

/**
 * Resolves the optimal speech recognition language tag for Philippine multilingual healthcare.
 * Supports Filipino/Tagalog ('fil-PH'), Philippine English ('en-PH'), and regional vernaculars.
 */
export function resolvePhilippineSpeechLanguage(
  requestedLang?: string,
  nav?: { language?: string; languages?: readonly string[] }
): string {
  if (requestedLang) return requestedLang;

  const n = nav !== undefined ? nav : (typeof navigator !== 'undefined' ? navigator : undefined);
  if (!n || !n.language) return 'fil-PH';

  const navLang = (n.language || '').toLowerCase();
  const navLangs = Array.isArray(n.languages)
    ? n.languages.map((l) => l.toLowerCase())
    : [];

  // Check for explicit Filipino / Tagalog preference
  if (
    navLang.startsWith('fil') ||
    navLang.startsWith('tl') ||
    navLangs.some((l) => l.startsWith('fil') || l.startsWith('tl'))
  ) {
    return 'fil-PH';
  }

  // Check for Philippine English preference
  if (navLang === 'en-ph' || navLangs.includes('en-ph')) {
    return 'en-PH';
  }

  // Default to system language if available or fil-PH
  return n.language || 'fil-PH';
}
