// src/lib/locationData.ts
//
// Region III (Central Luzon) municipality/city whitelist, plus a
// normalization helper that maps free-text clinic/patient location
// strings onto it. Structured as Region -> Province -> City so more
// regions can be added later without a rewrite.

export interface ProvinceOption {
  name: string;
  /** Canonical city/municipality display names, e.g. "Angeles City". Alphabetical. */
  cities: string[];
}

export interface RegionOption {
  name: string;
  provinces: ProvinceOption[];
}

export const PH_REGIONS: RegionOption[] = [
  {
    name: 'Region III (Central Luzon)',
    provinces: [
      {
        name: 'Bulacan',
        cities: [
          'Angat', 'Balagtas', 'Baliwag', 'Bocaue', 'Bulakan', 'Bustos', 'Calumpit',
          'Doña Remedios Trinidad', 'Guiguinto', 'Hagonoy', 'Malolos City', 'Marilao',
          'Meycauayan City', 'Norzagaray', 'Obando', 'Pandi', 'Paombong', 'Plaridel',
          'Pulilan', 'San Ildefonso', 'San Jose del Monte City', 'San Miguel',
          'San Rafael', 'Santa Maria',
        ],
      },
      {
        name: 'Pampanga',
        cities: [
          'Angeles City', 'Apalit', 'Arayat', 'Bacolor', 'Candaba', 'Clark',
          'Floridablanca', 'Guagua', 'Lubao', 'Mabalacat City', 'Macabebe', 'Magalang',
          'Masantol', 'Mexico', 'Minalin', 'Porac', 'San Fernando City', 'San Luis',
          'San Simon', 'Santa Ana', 'Santa Rita', 'Santo Tomas', 'Sasmuan',
        ],
      },
      {
        name: 'Tarlac',
        cities: [
          'Anao', 'Bamban', 'Camiling', 'Capas', 'Concepcion', 'Gerona', 'La Paz',
          'Mayantoc', 'Moncada', 'Paniqui', 'Pura', 'Ramos', 'San Clemente', 'San Jose',
          'San Manuel', 'Santa Ignacia', 'Tarlac City', 'Victoria',
        ],
      },
    ],
  },
];

interface CityLocation {
  city: string;
  province: string;
  region: string;
}

interface MatchEntry {
  tokenLower: string;
  tokenLength: number;
  canonical: string;
}

const CITY_INDEX = new Map<string, CityLocation>();
const MATCH_ENTRIES: MatchEntry[] = [];

for (const region of PH_REGIONS) {
  for (const province of region.provinces) {
    for (const city of province.cities) {
      CITY_INDEX.set(city, { city, province: province.name, region: region.name });
      MATCH_ENTRIES.push({ tokenLower: city.toLowerCase(), tokenLength: city.length, canonical: city });

      // A chartered city's bare name (without " City") is a common way
      // people actually type it -- e.g. real seed data has "San Fernando,
      // Pampanga" for what the whitelist canonically calls "San Fernando
      // City". Without this alias that data would fail to normalize.
      if (city.endsWith(' City')) {
        const bare = city.slice(0, -' City'.length);
        MATCH_ENTRIES.push({ tokenLower: bare.toLowerCase(), tokenLength: bare.length, canonical: city });
      }
    }
  }
}

// Longest token first so scanning a messy string never lets a short name
// win over a longer one it's a prefix of (e.g. "San Jose" vs "San Jose
// del Monte City").
MATCH_ENTRIES.sort((a, b) => b.tokenLength - a.tokenLength);

function isWordChar(ch: string | undefined): boolean {
  return !!ch && /[a-z0-9]/i.test(ch);
}

export interface NormalizedLocation {
  city: string;
  province: string;
  region: string;
  /** "City, Province", for display and as the canonical filter value. */
  display: string;
}

const normalizeCache = new Map<string, NormalizedLocation | null>();

/**
 * Scans `raw` (a clean "City, Province" string, or a messy "Hospital
 * Name, Street, City, Province" string) for the longest whitelisted city
 * name/alias appearing anywhere in it, case-insensitive and
 * word-boundary matched. Returns the canonical city/province/region, or
 * null if nothing in the whitelist matches -- callers should leave
 * `raw` displayed as-is in that case rather than hiding it.
 */
export function normalizeLocation(raw: string | null | undefined): NormalizedLocation | null {
  if (!raw) return null;
  const key = raw.trim();
  if (!key) return null;

  const cached = normalizeCache.get(key);
  if (cached !== undefined) return cached;

  const lower = key.toLowerCase();
  let result: NormalizedLocation | null = null;

  for (const entry of MATCH_ENTRIES) {
    const idx = lower.indexOf(entry.tokenLower);
    if (idx === -1) continue;

    const before = idx === 0 ? undefined : lower[idx - 1];
    const afterIdx = idx + entry.tokenLower.length;
    const after = afterIdx >= lower.length ? undefined : lower[afterIdx];
    if (isWordChar(before) || isWordChar(after)) continue;

    const loc = CITY_INDEX.get(entry.canonical)!;
    result = { city: loc.city, province: loc.province, region: loc.region, display: `${loc.city}, ${loc.province}` };
    break; // MATCH_ENTRIES is longest-first, so the first hit is the best hit
  }

  normalizeCache.set(key, result);
  return result;
}

export function listRegions(): RegionOption[] {
  return PH_REGIONS;
}

export function listProvinces(regionName: string): ProvinceOption[] {
  return PH_REGIONS.find((r) => r.name === regionName)?.provinces ?? [];
}

export function listCities(regionName: string, provinceName: string): string[] {
  return listProvinces(regionName).find((p) => p.name === provinceName)?.cities ?? [];
}

export type ProximityTier = 1 | 2 | 3 | 4;

/**
 * How close a clinic location is to a patient location, in the absence
 * of any real geodata: 1 = same whitelisted city, 2 = same province,
 * 3 = same region but different province, 4 = unknown (either side
 * doesn't normalize, or they share nothing).
 */
export function proximityTier(
  patientRaw: string | null | undefined,
  clinicRaw: string | null | undefined
): ProximityTier {
  const patient = normalizeLocation(patientRaw);
  const clinic = normalizeLocation(clinicRaw);
  if (!patient || !clinic) return 4;
  if (clinic.city === patient.city) return 1;
  if (clinic.province === patient.province) return 2;
  if (clinic.region === patient.region) return 3;
  return 4;
}
