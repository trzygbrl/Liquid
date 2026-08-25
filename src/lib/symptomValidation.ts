// src/lib/symptomValidation.ts
//
// Symptom Plausibility & Nonsense/Off-Topic Evaluation
//
// PURPOSE:
// Evaluates whether a patient's free-text intake input is a plausible description
// of a physical symptom before the AI matching flow forces a specialist match.
//
// DESIGN PRINCIPLES:
// 1. Distinct code path from emergency/crisis checks in src/lib/safetyGate.ts.
// 2. Warm, non-judgmental, gentle clinic-nurse tone with zero scolding.
// 3. Vague-but-genuine symptoms ("I don't feel good", "masama pakiramdam ko")
//    MUST remain accepted as plausible (optionally triggering gentle clarification).
// 4. Catches gibberish, single non-symptom words, and obvious off-topic queries.
// 5. Bilingual support: English and Tagalog / Taglish with localized examples.

export type SymptomPlausibilityStatus =
  | 'plausible'
  | 'vague_genuine'
  | 'gibberish'
  | 'too_short_or_empty'
  | 'off_topic';

export interface SymptomValidationResult {
  /** True if the input is a plausible or vague-genuine symptom description */
  isPlausible: boolean;
  status: SymptomPlausibilityStatus;
  reason?: string;
  gentlePrompt?: string;
  examples?: string[];
  detectedLanguage: 'en' | 'tl';
}

// Warm, supportive prompts by language
const GENTLE_PROMPTS = {
  en: {
    prompt:
      "We want to make sure we connect you with the right doctor. Could you describe what you're feeling physically, or where you're experiencing discomfort?",
    examples: [
      "Sharp pain in my lower back for the past 3 days",
      "Persistent dry cough with a mild fever since yesterday",
    ],
  },
  tl: {
    prompt:
      'Nais naming masigurado na maitutugma kayo sa tamang doktor. Maaari mo bang ilarawan kung ano ang nararamdaman mo sa iyong katawan o kung saan ang sumasakit?',
    examples: [
      'Masakit ang likod kapag yumuyuko nang mahigit 3 araw na',
      'May tuyong ubo at sinat mula pa kahapon',
    ],
  },
};

// Common single words or short phrases that represent genuine health symptoms
const SHORT_GENUINE_SYMPTOMS = new Set([
  // English
  'fever',
  'cough',
  'coughing',
  'colds',
  'cold',
  'flu',
  'headache',
  'migraine',
  'dizzy',
  'dizziness',
  'vertigo',
  'nausea',
  'vomit',
  'vomiting',
  'diarrhea',
  'rash',
  'rashes',
  'itch',
  'itching',
  'pain',
  'ache',
  'aching',
  'sore',
  'fatigue',
  'tired',
  'tiredness',
  'weak',
  'weakness',
  'asthma',
  'wound',
  'burn',
  'swelling',
  'swollen',
  'chills',
  'cramp',
  'cramps',
  'stomachache',
  'backache',
  'toothache',
  'earache',
  'palpitations',
  'insomnia',
  'allergy',
  'allergies',
  'sprain',
  'fracture',
  // Tagalog / Filipino
  'lagnat',
  'sinat',
  'ubo',
  'sipon',
  'hilo',
  'nahihilo',
  'sakit',
  'masakit',
  'kirot',
  'kumikirot',
  'hapdi',
  'mahapdi',
  'pantal',
  'makati',
  'pangangati',
  'suka',
  'pagsusuka',
  'nagsusuka',
  'tae',
  'pagtatae',
  'nagtatae',
  'hika',
  'hinihika',
  'manas',
  'namamaga',
  'pamamaga',
  'sugat',
  'paso',
  'ngalay',
  'nangangalay',
  'pulikat',
  'pinupulikat',
  'pananakit',
  'nanghihina',
  'nanlalata',
  'nilalagnat',
  'sinisipon',
  'inuubo',
]);

// Non-symptom trivial words
const TRIVIAL_NON_SYMPTOM_WORDS = new Set([
  'idk',
  'i dont know',
  "i don't know",
  'i don t know',
  'dunno',
  'hi',
  'hello',
  'hey',
  'yo',
  'test',
  'testing',
  'ok',
  'okay',
  'yes',
  'no',
  'none',
  'na',
  'n/a',
  'nothing',
  'help',
  'pls',
  'please',
  'secret',
  'haha',
  'hahaha',
  'lol',
  'lmao',
  'asdf',
  'qwerty',
  'wala',
  'ewan',
  'ano',
  'ayoko',
  'basta',
  'sige',
  'oo',
  'hindi',
  'meron',
  'mayroon',
  'lang',
  'po',
  'opo',
  'ko',
  'mo',
  'ako',
  'ikaw',
  'kami',
  'tayo',
  'sila',
  'siya',
  'ang',
  'ng',
  'sa',
  'mga',
  'just',
  'only',
  'really',
]);

// Patterns for vague but genuine symptoms that must be accepted
const VAGUE_GENUINE_PATTERNS = [
  /\b(i\s+do\s*n\s*'?\s*t\s+feel\s+good|not\s+feeling\s+well|feel\s+sick|feeling\s+sick|feeling\s+unwell|feel\s+unwell|feel\s+terrible|feel\s+bad|body\s+malaise|my\s+body\s+hurts|body\s+(is\s+)?aching|something\s+(feels|is)\s+wrong|i('?m|\s+am)\s+sick|feeling\s+weak|weakness\s+all\s+over|general\s+weakness|unwell|sickly)\b/i,
  /\b(hindi\s+maganda\s+(ang\s+)?pakiramdam|masama\s+(ang\s+)?pakiramdam|masama\s+pakiramdam|masakit\s+ang\s+katawan|masakit\s+katawan|nanghihina\s+ako|parang\s+lalagnatin|may\s+nararamdaman\s+ako|nanlalata|hindi\s+ako\s+okay|parang\s+may\s+sakit|masama\s+timpla|mabigat\s+ang\s+katawan)\b/i,
];

// Patterns for obvious off-topic non-medical queries
const OFF_TOPIC_PATTERNS = [
  // Travel / Booking
  /\b(book|reserve|buy|rent)\s+(a\s+|me\s+)?(flight|hotel|ticket|room|car|trip|vacation|plane)\b/i,
  /\b(flight|fly|travel)\s+to\s+[a-z]+/i,
  // Weather
  /\b(what('?s|\s+is)\s+the\s+weather|weather\s+today|is\s+it\s+raining|forecast\s+for|temperature\s+today)\b/i,
  // Food / Delivery
  /\b(order|deliver|buy)\s+(a\s+)?(pizza|burger|food|groceries|dinner|lunch|coffee|milktea)\b/i,
  // Coding / Tech / Creative tasks
  /\b(write|create|code|generate)\s+(a\s+|some\s+)?(python|javascript|typescript|code|script|program|app|website|html|sql|function|poem|essay|story|song)\b/i,
  /\b(what\s+is|solve|calculate)\s+\d+\s*[\+\-\*\/]\s*\d+\b/i,
  // Chatbot / Trivia
  /\b(who\s+is\s+the\s+president|tell\s+me\s+a\s+joke|who\s+won\s+the|what\s+is\s+the\s+capital\s+of|sing\s+me\s+a\s+song)\b/i,
];

// Common medical abbreviations that don't need vowels
const VALID_MEDICAL_ABBREVIATIONS = new Set([
  'bp',
  'dr',
  'doc',
  'mr',
  'ms',
  'mrs',
  'er',
  'or',
  'icu',
  'ent',
  'ob',
  'gyn',
  'tb',
  'uti',
  'gerd',
  'pcos',
  'std',
  'hiv',
  'ct',
  'mri',
  'xray',
  'cbc',
  'ecg',
  'ekg',
  'hmo',
]);

// Keyboard mash patterns
const KEYBOARD_MASH_PATTERNS = [
  /^[asdfghjkl]+$/i,
  /^[qwertyuiop]+$/i,
  /^[zxcvbnm]+$/i,
  /^(asdf|qwer|zxcv|hjkl|dfgh|jkl;)+/i,
];

/**
 * Detects whether the input is primarily Tagalog/Filipino or English.
 */
export function detectLanguage(text: string): 'en' | 'tl' {
  const normalized = text.toLowerCase();
  const tagalogTokens = [
    /\b(ang|ng|sa|mga|ko|mo|siya|sila|kami|tayo|po|opo)\b/,
    /\b(masakit|pakiramdam|katawan|ulo|tiyan|lalamunan|lagnat|ubo|sipon|hilo)\b/,
    /\b(nanghihina|nanlalata|sinat|binti|braso|likod|mata|tenga|ngipin|balat)\b/,
    /\b(pantal|makati|hirap|wala|ewan|meron|mayroon|sumasakit|kumikirot|parang)\b/,
    /\b(naninikip|mabigat|nahihirapan|kahapon|araw|linggo|buwan|gamot|doktor)\b/,
  ];

  let matches = 0;
  for (const pattern of tagalogTokens) {
    if (pattern.test(normalized)) {
      matches++;
    }
  }

  return matches >= 1 ? 'tl' : 'en';
}

/**
 * Checks whether a word or string looks like nonsensical gibberish or keyboard mashing.
 */
function isGibberish(text: string): boolean {
  const clean = text.trim().toLowerCase();

  // 1. Pure digits or pure punctuation/symbols with no letters
  if (!/[a-z]/i.test(clean)) {
    return true;
  }

  // 2. Character repetition (e.g. "aaaaaa", "zzzzzzzz")
  if (/(.)\1{4,}/.test(clean)) {
    return true;
  }

  // 3. Repeated pattern sequence (e.g. "asdfasdfasdf", "hahahaha", "lalalala")
  if (/^(.{2,5})\1{2,}$/i.test(clean)) {
    // If it's a known symptom word repeated for some reason, don't flag
    const sub = clean.slice(0, 4);
    if (!SHORT_GENUINE_SYMPTOMS.has(sub)) {
      return true;
    }
  }

  // 4. Keyboard mash regex
  if (KEYBOARD_MASH_PATTERNS.some((p) => p.test(clean)) && clean.length >= 4) {
    return true;
  }

  // 5. Check words for unpronounceable consonant clusters (no vowels)
  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  for (const word of words) {
    // Strip non-alpha characters from the word
    const alphaOnly = word.replace(/[^a-z]/g, '');
    if (alphaOnly.length >= 5) {
      const hasVowels = /[aeiouy]/i.test(alphaOnly);
      if (!hasVowels && !VALID_MEDICAL_ABBREVIATIONS.has(alphaOnly)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Evaluates whether patient intake input is a plausible physical symptom description.
 *
 * @param symptomText Raw symptom description from patient intake form
 * @returns SymptomValidationResult with plausibility status and localized guidance if needed
 */
export function evaluateSymptomPlausibility(symptomText: string): SymptomValidationResult {
  const language = detectLanguage(symptomText || '');
  const promptConfig = GENTLE_PROMPTS[language];

  // 1. Empty or whitespace-only input
  if (!symptomText || typeof symptomText !== 'string' || symptomText.trim().length === 0) {
    return {
      isPlausible: false,
      status: 'too_short_or_empty',
      reason: 'Input is empty or whitespace only',
      gentlePrompt: promptConfig.prompt,
      examples: promptConfig.examples,
      detectedLanguage: language,
    };
  }

  const rawTrimmed = symptomText.trim();
  const normalized = rawTrimmed
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Check for vague-but-genuine health symptoms first
  // These should ALWAYS be accepted as plausible, never rejected as nonsense
  for (const pattern of VAGUE_GENUINE_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isPlausible: true,
        status: 'vague_genuine',
        reason: 'Recognized as a vague but genuine health symptom',
        detectedLanguage: language,
      };
    }
  }

  // 3. Check for recognized short genuine single-word symptoms
  if (SHORT_GENUINE_SYMPTOMS.has(normalized)) {
    return {
      isPlausible: true,
      status: 'plausible',
      reason: 'Recognized valid health symptom keyword',
      detectedLanguage: language,
    };
  }

  // 4. Check for trivial non-symptom single words / short phrases
  if (TRIVIAL_NON_SYMPTOM_WORDS.has(normalized)) {
    return {
      isPlausible: false,
      status: 'too_short_or_empty',
      reason: 'Input is a short non-symptom word without clinical context',
      gentlePrompt: promptConfig.prompt,
      examples: promptConfig.examples,
      detectedLanguage: language,
    };
  }

  // 4.5 Check if all words in the input are trivial non-symptom / filler words
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);
  if (words.length > 0 && words.every((w) => TRIVIAL_NON_SYMPTOM_WORDS.has(w))) {
    return {
      isPlausible: false,
      status: 'too_short_or_empty',
      reason: 'Input contains only non-symptom filler words without clinical context',
      gentlePrompt: promptConfig.prompt,
      examples: promptConfig.examples,
      detectedLanguage: language,
    };
  }

  // 5. Very short input without recognizable symptom content
  if (normalized.length < 3) {
    return {
      isPlausible: false,
      status: 'too_short_or_empty',
      reason: 'Input is too short to evaluate',
      gentlePrompt: promptConfig.prompt,
      examples: promptConfig.examples,
      detectedLanguage: language,
    };
  }

  // 6. Check for obvious off-topic non-medical queries
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(rawTrimmed)) {
      return {
        isPlausible: false,
        status: 'off_topic',
        reason: 'Input appears to be an off-topic non-health request',
        gentlePrompt: promptConfig.prompt,
        examples: promptConfig.examples,
        detectedLanguage: language,
      };
    }
  }

  // 7. Check for gibberish / keyboard mashing
  if (isGibberish(rawTrimmed)) {
    return {
      isPlausible: false,
      status: 'gibberish',
      reason: 'Input appears to be keyboard mash or uninterpretable text',
      gentlePrompt: promptConfig.prompt,
      examples: promptConfig.examples,
      detectedLanguage: language,
    };
  }

  // 8. Default: Plausible symptom description
  return {
    isPlausible: true,
    status: 'plausible',
    reason: 'Plausible symptom description',
    detectedLanguage: language,
  };
}
