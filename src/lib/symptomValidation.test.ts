// src/lib/symptomValidation.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSymptomPlausibility,
  detectLanguage,
} from './symptomValidation.ts';

describe('evaluateSymptomPlausibility', () => {
  describe('1. Gibberish & Keyboard Mashing', () => {
    const gibberishSamples = [
      'asdfghjkl',
      'qwertyuiop',
      'zzzzzzzz',
      'asdfasdfasdf',
      '1234567890',
      '!!!@@@###$$$',
      'bcdfghjklmn',
      'lkjhgfdsa',
    ];

    for (const sample of gibberishSamples) {
      it(`rejects gibberish: "${sample}"`, () => {
        const result = evaluateSymptomPlausibility(sample);
        assert.equal(
          result.isPlausible,
          false,
          `Expected "${sample}" to be rejected as not plausible`
        );
        assert.ok(
          result.gentlePrompt && result.gentlePrompt.length > 0,
          'Should provide a gentle prompt'
        );
        assert.ok(
          result.examples && result.examples.length >= 1,
          'Should provide examples'
        );
      });
    }
  });

  describe('2. Coherent-but-Off-Topic Queries', () => {
    const offTopicSamples = [
      'book me a flight to Boracay',
      "what's the weather today?",
      'order a pizza for dinner',
      'write a python script to parse json',
      'who is the president of the Philippines?',
      'tell me a joke',
      'what is 2 + 2',
      'reserve a hotel room in Cebu',
    ];

    for (const sample of offTopicSamples) {
      it(`rejects off-topic query: "${sample}"`, () => {
        const result = evaluateSymptomPlausibility(sample);
        assert.equal(
          result.isPlausible,
          false,
          `Expected "${sample}" to be rejected as off-topic`
        );
        assert.equal(result.status, 'off_topic');
        assert.ok(result.gentlePrompt, 'Should provide a gentle prompt');
        assert.ok(result.examples, 'Should provide examples');
      });
    }
  });

  describe('3. Very Short Input With No Context', () => {
    const shortSamples = [
      'idk',
      'hi',
      'hello',
      'test',
      'none',
      'wala',
      'ewan',
      'na',
      'yo',
      'haha',
    ];

    for (const sample of shortSamples) {
      it(`rejects short non-symptom input: "${sample}"`, () => {
        const result = evaluateSymptomPlausibility(sample);
        assert.equal(
          result.isPlausible,
          false,
          `Expected "${sample}" to be rejected as too short/non-symptom`
        );
        assert.equal(result.status, 'too_short_or_empty');
        assert.ok(result.gentlePrompt, 'Should provide a gentle prompt');
      });
    }
  });

  describe('4. Vague-but-Genuine Symptoms (Must Be Accepted)', () => {
    const vagueGenuineSamples = [
      "I don't feel good",
      'Not feeling well',
      'I feel sick',
      'feeling unwell',
      'My body hurts',
      'Masama ang pakiramdam ko',
      'Hindi maganda pakiramdam ko',
      'Masakit ang katawan ko',
      'Nanghihina ako',
      'Parang lalagnatin',
    ];

    for (const sample of vagueGenuineSamples) {
      it(`accepts vague-but-genuine symptom: "${sample}"`, () => {
        const result = evaluateSymptomPlausibility(sample);
        assert.equal(
          result.isPlausible,
          true,
          `Expected "${sample}" to be accepted as a genuine symptom`
        );
        assert.equal(result.status, 'vague_genuine');
      });
    }
  });

  describe('5. Specific Genuine Symptoms (English & Tagalog)', () => {
    const specificSamples = [
      'I have a severe throbbing headache on my left temple and sensitivity to light',
      'Persistent dry cough with mild fever for 3 days',
      'Masakit ang lalamunan at may plema kapag umuubo',
      'Makating pantal sa braso at binti pagkatapos kumain ng hipon',
      'fever',
      'lagnat',
      'migraine',
      'ubo',
      'dizziness',
    ];

    for (const sample of specificSamples) {
      it(`accepts valid symptom description: "${sample}"`, () => {
        const result = evaluateSymptomPlausibility(sample);
        assert.equal(
          result.isPlausible,
          true,
          `Expected "${sample}" to be accepted as plausible`
        );
      });
    }
  });

  describe('6. Language Detection & Appropriate Gentle Prompts', () => {
    it('detects English and returns English prompt/examples', () => {
      const result = evaluateSymptomPlausibility('asdfghjkl');
      assert.equal(result.detectedLanguage, 'en');
      assert.match(result.gentlePrompt!, /doctor|symptom|discomfort/i);
    });

    it('detects Tagalog and returns Tagalog prompt/examples', () => {
      const result = evaluateSymptomPlausibility('wala ewan ko po');
      assert.equal(result.detectedLanguage, 'tl');
      assert.match(result.gentlePrompt!, /doktor|nararamdaman|sumasakit/i);
    });
  });

  describe('7. 2-Strike Guardrail & Pre-Submission Screening', () => {
    const unrelatedPhrases = [
      'take me home',
      'i am rich',
      'i have a lot of money',
      'hello how are you',
      'who is the best doctor',
    ];

    for (const phrase of unrelatedPhrases) {
      it(`rejects phrase with no symptoms: "${phrase}"`, () => {
        const result = evaluateSymptomPlausibility(phrase);
        assert.equal(
          result.isPlausible,
          false,
          `Expected "${phrase}" to be rejected as having no determined symptoms`
        );
        assert.equal(result.status, 'off_topic');
      });
    }

    it('catches first strike off-topic input and provides localized retry guidance', () => {
      const firstAttempt = evaluateSymptomPlausibility('order a pepperoni pizza for dinner');
      assert.equal(firstAttempt.isPlausible, false);
      assert.equal(firstAttempt.status, 'off_topic');
      assert.ok(firstAttempt.examples && firstAttempt.examples.length >= 1);
    });

    it('catches second strike gibberish input', () => {
      const secondAttempt = evaluateSymptomPlausibility('asdfghjklqwerty');
      assert.equal(secondAttempt.isPlausible, false);
      assert.equal(secondAttempt.status, 'gibberish');
    });

    it('accepts genuine symptoms when patient corrects on retry', () => {
      // First attempt was invalid
      const attempt1 = evaluateSymptomPlausibility('tell me a joke');
      assert.equal(attempt1.isPlausible, false);

      // Patient retries with proper symptoms
      const attempt2 = evaluateSymptomPlausibility('Masakit ang likod ko kapag yumuyuko');
      assert.equal(attempt2.isPlausible, true);
    });
  });
});
