// src/lib/safetyGate.ts
//
// Emergency Safety Gate Logic — PRD Section 8.2 (Task 3.3)
//
// CALIBRATED DESIGN RULES:
// 1. Deterministic rule-based evaluation (zero external dependencies, zero latency).
// 2. Evaluates specific objective symptom combinations in English & Tagalog.
// 3. Do NOT trigger on tone, punctuation, or intensity words ("dying", "worst pain ever", "emergency", ALL CAPS).
// 4. Tone of message: calm, non-alarming — no red banners or panic language.

export interface SafetyGateResult {
  isEmergency: boolean;
  matchedCriteria?: string;
  message?: string;
}

const CALM_EMERGENCY_MESSAGE =
  'These symptoms can sometimes be serious. Please consider seeking urgent or emergency care.';

/**
 * Normalizes input text for keyword and regex matching:
 * - Converts to lower case
 * - Replaces punctuation with single spaces (except hyphens inside words)
 * - Collapses whitespace
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether any regex in the array matches the normalized text.
 */
function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

// ─── 1. Chest Pain + Shortness of Breath ─────────────────────────────────────
// Must contain BOTH chest discomfort AND respiratory distress
const CHEST_PAIN_PATTERNS = [
  /\b(chest|dibdib)\s+(hurts?|pain|pressure|tightness|heaviness|discomfort|burning|aching|aches?)\b/,
  /\b(pain|pressure|tightness|heaviness|discomfort|burning|aching|aches?|hurts?)\s+(in|around|on|sa)\s+(my\s+|the\s+)?(chest|dibdib)\b/,
  /\b(masakit|naninikip|paninikip|mabigat|kumikirot|kumikipot|sumasakit)\s+(ang|ng|sa)?\s*dibdib\b/,
  /\b(chest\s+is\s+(hurting|aching|tight|heavy|painful))\b/,
];

const BREATHING_DISTRESS_PATTERNS = [
  /\b(shortness\s+of\s+breath|short\s+of\s+breath|trouble\s+breathing|difficulty\s+breathing|hard\s+to\s+breathe|breathless|breathlessness|gasping|cannot\s+catch\s+(my\s+)?breath)\b/,
  /\b(hirap\s+huminga|nahihirapang\s+huminga|kapos\s+sa\s+hininga|hindi\s+makahinga|kinakapos\s+ng\s+hininga|hirap\s+sa\s+paghinga)\b/,
];

// ─── 2. Chest Pain + Radiating Arm/Jaw Pain ───────────────────────────────────
// Must contain BOTH chest discomfort AND radiating pain to arm/jaw/shoulder/back
const RADIATING_PATTERNS = [
  /\b(radiat(ing|es|ed)?|spread(ing|s)?)\s+(to\s+)?(my\s+|the\s+)?(left\s+)?(arm|jaw|shoulder|neck|back)\b/,
  /\b(left\s+arm|jaw|shoulder)\s+(pain|ache|hurts?|aching)\b/,
  /\b(pain|ache|aching|hurts?)\s+(in|down|around|to)\s+(my\s+|the\s+)?(left\s+)?(arm|jaw|shoulder|neck)\b/,
  /\b(kumakalat|umaabot|tumatagos)\s+(sa\s+)?(kaliwang\s+)?(braso|panga|balikat|leeg)\b/,
  /\b(masakit|sumasakit)\s+din\s+ang\s+(braso|panga|balikat)\b/,
];

// ─── 3. Severe Standalone Difficulty Breathing ───────────────────────────────
// Severe/acute standalone inability to breathe (not mild cough or stuffy nose)
const SEVERE_BREATHING_PATTERNS = [
  /\b(cannot\s+breathe|can\'?t\s+breathe|unable\s+to\s+breathe|gasping\s+for\s+air|suffocating|choking)\b/,
  /\b(sobrang\s+hirap\s+huminga|hindi\s+na\s+makahinga|hindi\s+makahinga\s+nang\s+maayos|nalulunod\s+sa\s+hangin)\b/,
];

// ─── 4. Sudden Numbness or Weakness on One Side (Stroke / F.A.S.T.) ───────────
const STROKE_PATTERNS = [
  /\b(sudden|suddenly|bigla|biglang)\b.*\b(numbness|numb|weakness|weak|paraly(sis|zed)|droop(ing)?|manhid|nanghina|bagsak)\b.*\b(one\s+side|left\s+side|right\s+side|half\s+of\s+(my\s+)?(body|face)|kalahati\s+ng\s+(katawan|mukha))\b/,
  /\b(numbness|numb|weakness|weak|paraly(sis|zed)|droop(ing)?|manhid|nanghina|bagsak)\b.*\b(sudden|suddenly|bigla|biglang)\b.*\b(one\s+side|left\s+side|right\s+side|half\s+of\s+(my\s+)?(body|face)|kalahati\s+ng\s+(katawan|mukha))\b/,
  /\b(facial\s+droop|face\s+drooping|drooping\s+face|slurred\s+speech|slurring\s+words)\b/,
  /\b(ngiwi\s+ang\s+mukha|nabubulol\s+magsalita|pumaling\s+ang\s+mukha)\b/,
];

// ─── 5. Loss of Consciousness / Fainting ─────────────────────────────────────
const LOSS_OF_CONSCIOUSNESS_PATTERNS = [
  /\b(passed\s+out|pass\s+out|lost\s+consciousness|loss\s+of\s+consciousness|blacked\s+out|blacking\s+out|fainted|fainting|collapsed|collapse)\b/,
  /\b(nawalan\s+ng\s+malay|nawawalan\s+ng\s+malay|nahimatay|nahihimatay|nag-collapse|nagcollapse)\b/,
];

// ─── 6. Severe Uncontrolled Bleeding ─────────────────────────────────────────
const UNCONTROLLED_BLEEDING_PATTERNS = [
  /\b(uncontrolled\s+bleeding|bleeding\s+(will\s+not|won\'?t|does\s+not)\s+stop|continuous(ly)?\s+bleeding|gushing\s+blood|profuse\s+bleeding|hemorrhag(e|ing))\b/,
  /\b(vomiting\s+blood|throwing\s+up\s+blood|coughing\s+up\s+blood)\b/,
  /\b(hindi\s+tumitigil\s+ang\s+(pagdurugo|pagdugo|dugo)|malakas\s+na\s+pagdurugo|sumusuka\s+ng\s+dugo|umubo\s+ng\s+dugo)\b/,
];

/**
 * Evaluates symptom text against the 6 calibrated emergency criteria.
 * Runs deterministically with zero latency before any AI model call.
 */
export function checkEmergencySymptoms(symptomText: string): SafetyGateResult {
  if (!symptomText || typeof symptomText !== 'string') {
    return { isEmergency: false };
  }

  const normalized = normalizeText(symptomText);
  if (!normalized) {
    return { isEmergency: false };
  }

  // 1. Chest Pain + Shortness of breath
  if (
    matchesAny(normalized, CHEST_PAIN_PATTERNS) &&
    matchesAny(normalized, BREATHING_DISTRESS_PATTERNS)
  ) {
    return {
      isEmergency: true,
      matchedCriteria: 'Chest pain + difficulty breathing',
      message: CALM_EMERGENCY_MESSAGE,
    };
  }

  // 2. Chest Pain + Radiating arm/jaw/shoulder pain
  if (
    matchesAny(normalized, CHEST_PAIN_PATTERNS) &&
    matchesAny(normalized, RADIATING_PATTERNS)
  ) {
    return {
      isEmergency: true,
      matchedCriteria: 'Chest pain + radiating arm/jaw pain',
      message: CALM_EMERGENCY_MESSAGE,
    };
  }

  // 3. Severe difficulty breathing (standalone)
  if (matchesAny(normalized, SEVERE_BREATHING_PATTERNS)) {
    return {
      isEmergency: true,
      matchedCriteria: 'Severe difficulty breathing',
      message: CALM_EMERGENCY_MESSAGE,
    };
  }

  // 4. Sudden numbness/weakness on one side of body (Stroke)
  if (matchesAny(normalized, STROKE_PATTERNS)) {
    return {
      isEmergency: true,
      matchedCriteria: 'Sudden unilateral weakness/numbness or facial droop',
      message: CALM_EMERGENCY_MESSAGE,
    };
  }

  // 5. Loss of consciousness / fainting
  if (matchesAny(normalized, LOSS_OF_CONSCIOUSNESS_PATTERNS)) {
    return {
      isEmergency: true,
      matchedCriteria: 'Loss of consciousness or fainting',
      message: CALM_EMERGENCY_MESSAGE,
    };
  }

  // 6. Severe uncontrolled bleeding
  if (matchesAny(normalized, UNCONTROLLED_BLEEDING_PATTERNS)) {
    return {
      isEmergency: true,
      matchedCriteria: 'Severe uncontrolled bleeding',
      message: CALM_EMERGENCY_MESSAGE,
    };
  }

  return { isEmergency: false };
}
