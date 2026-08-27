import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendWithOverlapRemoval,
  deduplicatePhrases,
  mergeTextChunks,
  cleanAndMergeSpeechResults,
  createSpeechThrottler,
} from './speechRecognition.ts';
import type { SpeechResultItem } from './speechRecognition.ts';

describe('appendWithOverlapRemoval', () => {
  it('handles empty inputs gracefully', () => {
    assert.equal(appendWithOverlapRemoval('', ''), '');
    assert.equal(appendWithOverlapRemoval('hello', ''), 'hello');
    assert.equal(appendWithOverlapRemoval('', 'world'), 'world');
  });

  it('returns prev if next is identical to prev (ignoring case)', () => {
    assert.equal(appendWithOverlapRemoval('headache', 'headache'), 'headache');
    assert.equal(appendWithOverlapRemoval('Headache', 'headache'), 'Headache');
  });

  it('fixes Android Chrome bug where next starts with prev (cumulative sentence)', () => {
    const prev = 'masakit ang ulo';
    const next = 'masakit ang ulo at lagnat';
    assert.equal(appendWithOverlapRemoval(prev, next), 'masakit ang ulo at lagnat');
  });

  it('returns prev if prev already ends with next', () => {
    const prev = 'I have fever and cough';
    const next = 'cough';
    assert.equal(appendWithOverlapRemoval(prev, next), 'I have fever and cough');
  });

  it('removes word-level boundary overlap', () => {
    const prev = 'I have a high fever and';
    const next = 'fever and a cough';
    assert.equal(appendWithOverlapRemoval(prev, next), 'I have a high fever and a cough');
  });

  it('merges non-overlapping segments with a space', () => {
    const prev = 'I feel dizzy.';
    const next = 'May lagnat din ako';
    assert.equal(appendWithOverlapRemoval(prev, next), 'I feel dizzy. May lagnat din ako');
  });
});

describe('deduplicatePhrases', () => {
  it('handles empty text', () => {
    assert.equal(deduplicatePhrases(''), '');
  });

  it('removes consecutive duplicate single words', () => {
    assert.equal(deduplicatePhrases('fever fever cough cough'), 'fever cough');
    assert.equal(deduplicatePhrases('lagnat lagnat ubo ubo'), 'lagnat ubo');
  });

  it('removes consecutive identical multi-word phrases', () => {
    assert.equal(
      deduplicatePhrases('masakit ang ulo masakit ang ulo'),
      'masakit ang ulo'
    );
    assert.equal(
      deduplicatePhrases('I feel sick today I feel sick today and weak'),
      'I feel sick today and weak'
    );
  });

  it('leaves normal non-duplicate phrases intact', () => {
    const text = 'Masakit ang tiyan ko simula kahapon pagkatapos kumain';
    assert.equal(deduplicatePhrases(text), text);
  });
});

describe('mergeTextChunks', () => {
  it('merges an array of chunks without duplicates', () => {
    const chunks = ['I have fever', 'I have fever and headache', 'headache since yesterday'];
    assert.equal(mergeTextChunks(chunks), 'I have fever and headache since yesterday');
  });
});

describe('cleanAndMergeSpeechResults', () => {
  it('handles Android Chrome cumulative interim that includes final chunk', () => {
    const results: SpeechResultItem[] = [
      { 0: { transcript: 'masakit ang ulo' }, isFinal: true },
      { 0: { transcript: 'masakit ang ulo at nilalagnat' }, isFinal: false },
    ];
    assert.equal(
      cleanAndMergeSpeechResults(results),
      'masakit ang ulo at nilalagnat'
    );
  });

  it('handles duplicate final results emitted by mobile speech service', () => {
    const results: SpeechResultItem[] = [
      { 0: { transcript: 'masakit ang ulo' }, isFinal: true },
      { 0: { transcript: 'masakit ang ulo' }, isFinal: true },
      { 0: { transcript: 'at nilalagnat' }, isFinal: true },
    ];
    assert.equal(
      cleanAndMergeSpeechResults(results),
      'masakit ang ulo at nilalagnat'
    );
  });

  it('handles desktop Chrome clean separate chunks', () => {
    const results: SpeechResultItem[] = [
      { 0: { transcript: 'I have fever' }, isFinal: true },
      { 0: { transcript: 'and headache' }, isFinal: true },
      { 0: { transcript: 'since yesterday' }, isFinal: false },
    ];
    assert.equal(
      cleanAndMergeSpeechResults(results),
      'I have fever and headache since yesterday'
    );
  });

  it('merges seamlessly with existing baseText without duplication', () => {
    const results: SpeechResultItem[] = [
      { 0: { transcript: 'masakit ang ulo at lagnat' }, isFinal: true },
    ];
    const baseText = 'masakit ang ulo';
    assert.equal(
      cleanAndMergeSpeechResults(results, baseText),
      'masakit ang ulo at lagnat'
    );
  });

  it('appends cleanly to baseText with punctuation', () => {
    const results: SpeechResultItem[] = [
      { 0: { transcript: 'may ubo rin' }, isFinal: true },
    ];
    const baseText = 'Masakit ang lalamunan.';
    assert.equal(
      cleanAndMergeSpeechResults(results, baseText),
      'Masakit ang lalamunan. may ubo rin'
    );
  });
});

describe('createSpeechThrottler', () => {
  it('flush executes immediately with latest arguments', () => {
    let executedValue = '';
    const throttler = createSpeechThrottler((val: string) => {
      executedValue = val;
    }, 50);

    throttler.flush('immediate text');
    assert.equal(executedValue, 'immediate text');
  });

  it('cancel prevents scheduled execution', (t, done) => {
    let executed = false;
    const throttler = createSpeechThrottler(() => {
      executed = true;
    }, 50);

    throttler.schedule();
    throttler.cancel();

    setTimeout(() => {
      assert.equal(executed, false);
      done();
    }, 80);
  });
});
