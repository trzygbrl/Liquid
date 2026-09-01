// src/lib/vectorMatch.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDoctorProfileString,
  vectorSearchDoctors,
  type ProfileInput,
} from './vectorMatch.ts';
import { rankDoctors, type DoctorRecord } from './doctorRanking.ts';

describe('vectorMatch & Vector Ranking Suite', () => {
  describe('Test group 1 — buildDoctorProfileString()', () => {
    it('doctor with sub_specialty includes both specialty and sub_specialty', () => {
      const doctor: ProfileInput = {
        name: 'Dr. Maria Santos',
        specialty: 'Cardiology',
        sub_specialty: 'Interventional Cardiology',
        credentials: 'MD, FPCP',
        clinics: [{ name: 'St. Luke’s Medical Center', location: 'Quezon City, Metro Manila' }],
      };

      const result = buildDoctorProfileString(doctor);
      assert.ok(result.includes('Cardiology'), 'Must contain specialty');
      assert.ok(result.includes('sub-specialty: Interventional Cardiology'), 'Must contain sub_specialty label and value');
      assert.ok(result.includes('Dr. Maria Santos'), 'Must contain doctor name');
      assert.ok(result.includes('St. Luke’s Medical Center in Quezon City, Metro Manila'), 'Must format clinics');
    });

    it('doctor with sub_specialty = null does not contain "sub-specialty:"', () => {
      const doctor: ProfileInput = {
        name: 'Dr. Juan Dela Cruz',
        specialty: 'General Practice',
        sub_specialty: null,
        credentials: 'MD',
        clinics: [{ name: 'Angeles City Clinic', location: 'Angeles City, Pampanga' }],
      };

      const result = buildDoctorProfileString(doctor);
      assert.ok(result.includes('General Practice'), 'Must contain specialty');
      assert.equal(result.includes('sub-specialty:'), false, 'Must NOT contain sub-specialty label');
    });

    it('doctor with empty clinics array returns a valid string without throwing', () => {
      const doctor: ProfileInput = {
        name: 'Dr. Ana Gomez',
        specialty: 'Dermatology',
        sub_specialty: null,
        credentials: null,
        clinics: [],
      };

      assert.doesNotThrow(() => {
        const result = buildDoctorProfileString(doctor);
        assert.ok(result.includes('Clinic(s): Not specified'), 'Should state Not specified for clinics');
        assert.ok(result.includes('Credentials: Not specified'), 'Should state Not specified for credentials');
      });
    });

    it('specialty in SPECIALTY_PLAIN_MAP contains the plain description', () => {
      const doctor: ProfileInput = {
        name: 'Dr. Jose Reyes',
        specialty: 'Ophthalmology',
        sub_specialty: 'Retina',
        credentials: 'MD',
        clinics: [{ name: 'Eye Center', location: 'San Fernando, Pampanga' }],
      };

      const result = buildDoctorProfileString(doctor);
      assert.ok(
        result.includes('Treats blurry vision, cataracts, glaucoma, eye redness, eye pain, and vision correction.'),
        'Should include Ophthalmology plain-language focus'
      );
    });

    it('specialty not in map falls back gracefully to the specialty name', () => {
      const doctor: ProfileInput = {
        name: 'Dr. Alex Tan',
        specialty: 'Aeronautical Medicine',
        sub_specialty: null,
        credentials: 'MD',
        clinics: [],
      };

      const result = buildDoctorProfileString(doctor);
      assert.ok(result.includes('Medical focus: Aeronautical Medicine'), 'Should fallback to specialty name');
    });
  });

  describe('Test group 2 — vectorSearchDoctors() with mocked Supabase client', () => {
    it('when the RPC returns an error: function returns [] without throwing', async () => {
      const mockSupabase = {
        rpc: async (_fnName: string, _params: any) => {
          return { data: null, error: { message: 'extension "vector" does not exist' } };
        },
      } as any;

      const dummyEmbedding = new Array(768).fill(0.01);
      const results = await vectorSearchDoctors(mockSupabase, dummyEmbedding, 20);

      assert.ok(Array.isArray(results), 'Must return an array');
      assert.equal(results.length, 0, 'Must return empty array on RPC failure');
    });

    it('when the RPC returns valid data: function returns { id, similarity }[] sorted by similarity descending', async () => {
      const mockSupabase = {
        rpc: async (_fnName: string, _params: any) => {
          return {
            data: [
              { id: 'doc-2', similarity: 0.75 },
              { id: 'doc-1', similarity: 0.94 },
              { id: 'doc-3', similarity: 0.62 },
            ],
            error: null,
          };
        },
      } as any;

      const dummyEmbedding = new Array(768).fill(0.01);
      const results = await vectorSearchDoctors(mockSupabase, dummyEmbedding, 20);

      assert.equal(results.length, 3);
      assert.equal(results[0].id, 'doc-1');
      assert.equal(results[0].similarity, 0.94);
      assert.equal(results[1].id, 'doc-2');
      assert.equal(results[1].similarity, 0.75);
      assert.equal(results[2].id, 'doc-3');
      assert.equal(results[2].similarity, 0.62);
    });
  });

  describe('Test group 3 — Tier 0 sort in rankDoctors()', () => {
    const mockDoctorA: DoctorRecord = {
      id: 'doc-a',
      name: 'Dr. Alpha (High Similarity, Lower Rating)',
      credentials: 'MD',
      specialty: 'Cardiology',
      sub_specialty: 'Interventional Cardiology',
      hmo_accreditations: ['Maxicare'],
      verification_status: 'verified',
      clinics: [
        {
          id: 'clinic-a',
          name: 'Alpha Clinic',
          room_details: 'Room 101',
          location: 'Angeles City, Pampanga',
          consultation_fee: 1000,
        },
      ],
      schedule_slots: [],
      reviews: [{ rating: 3.5 }],
    };

    const mockDoctorB: DoctorRecord = {
      id: 'doc-b',
      name: 'Dr. Beta (Lower Similarity, 5.0 Rating)',
      credentials: 'MD',
      specialty: 'Cardiology',
      sub_specialty: 'Interventional Cardiology',
      hmo_accreditations: ['Maxicare'],
      verification_status: 'verified',
      clinics: [
        {
          id: 'clinic-b',
          name: 'Beta Clinic',
          room_details: 'Room 202',
          location: 'San Fernando, Pampanga',
          consultation_fee: 1000,
        },
      ],
      schedule_slots: [],
      reviews: [{ rating: 5.0 }, { rating: 5.0 }],
    };

    it('ranks A first when similarityScores Map has A = 0.92, B = 0.65 (Tier 0 overrides Tier 3 rating)', () => {
      const similarityScores = new Map<string, number>([
        ['doc-a', 0.92],
        ['doc-b', 0.65],
      ]);

      const result = rankDoctors(
        [mockDoctorB, mockDoctorA],
        'Cardiology',
        'Interventional Cardiology',
        'Maxicare',
        similarityScores
      );

      assert.equal(result.vectorSearchApplied, true, 'vectorSearchApplied must be true');
      assert.equal(result.ranked.length, 2);
      assert.equal(result.ranked[0].id, 'doc-a', 'Doc A with 0.92 similarity must rank first');
      assert.equal(result.ranked[0].similarityScore, 0.92);
      assert.equal(result.ranked[1].id, 'doc-b', 'Doc B with 0.65 similarity must rank second');
      assert.equal(result.ranked[1].similarityScore, 0.65);
    });

    it('without similarityScores map, existing Tier 1-4 order is unchanged (regression test)', () => {
      const result = rankDoctors(
        [mockDoctorA, mockDoctorB],
        'Cardiology',
        'Interventional Cardiology',
        'Maxicare'
      );

      assert.equal(result.vectorSearchApplied, false, 'vectorSearchApplied must be false');
      assert.equal(result.ranked.length, 2);
      assert.equal(
        result.ranked[0].id,
        'doc-b',
        'Without vector scores, Doc B with 5.0 rating ranks first via Tier 3 rating sort'
      );
      assert.equal(result.ranked[0].similarityScore, 0);
      assert.equal(result.ranked[1].id, 'doc-a');
      assert.equal(result.ranked[1].similarityScore, 0);
    });
  });
});
