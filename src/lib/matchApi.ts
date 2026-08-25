// src/lib/matchApi.ts
//
// Typed client-side helper for POST /api/match.
// Import callMatchApi() and the result types from here in:
//   - Task 3.4's result screen (which wires into IntakeFlow's onComplete prop)
//   - Any future component that needs to call the matching pipeline
//
// The onComplete prop on IntakeFlow (src/components/IntakeFlow.tsx) expects:
//   onComplete?: (data: IntakeCompleteData) => void
//
// Task 3.4 will render:
//   <IntakeFlow onComplete={async (data) => {
//     const result = await callMatchApi({
//       symptomText: data.symptomText,
//       name: data.name,
//       age: data.age,
//       sex: data.sex,
//       location: data.location,
//     });
//     // if result.type === 'match', navigate to show results
//     // if result.type === 'clarify', show follow-up question, then re-call
//     //   with conversationHistory appended
//   }} />

export type MatchResult = {
  type: 'match';
  specialty: string;
  sub_specialty: string | null;
  reason: string;
};

export type ClarifyResult = {
  type: 'clarify';
  question: string;
};

export type EmergencyResult = {
  type: 'emergency';
  message: string;
  matchedCriteria?: string;
};

export type MatchApiResult = MatchResult | ClarifyResult | EmergencyResult;

export interface MatchApiRequest {
  /** Required. The free-text symptom description from IntakeFlow step 3 */
  symptomText: string;
  /** Optional. Patient's first name, used for a humanised prompt preamble */
  name?: string;
  /** Optional. Patient's age */
  age?: number;
  /** Optional. 'male' | 'female' | 'other' */
  sex?: string;
  /** Optional. City/province, e.g. "Angeles City, Pampanga" */
  location?: string;
  /** Optional. True if consultation is being booked on behalf of a family member */
  isForFamilyMember?: boolean;
  /**
   * Optional. Multi-turn history for clarification follow-ups.
   * After a { type: 'clarify' } response, append the model's question as
   * { role: 'model', text: <question> } and the patient's answer as
   * { role: 'user', text: <answer> }, then call again. The route re-runs
   * the LLM with the full history so it can now return a { type: 'match' }.
   */
  conversationHistory?: Array<{ role: 'user' | 'model'; text: string }>;
}

/**
 * Call the AI symptom-matching API route.
 * Throws on HTTP errors (4xx, 5xx). On success, always returns 200 with
 * either a MatchResult or ClarifyResult; never throws for AI-level failures.
 */
export async function callMatchApi(req: MatchApiRequest): Promise<MatchApiResult> {
  const res = await fetch('/api/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`Match API error: ${res.status}`);
  }
  return res.json() as Promise<MatchApiResult>;
}
