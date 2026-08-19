// src/lib/specialtyHelpers.ts
//
// Plain-language medical specialty guides and friendly translations
// for PRD Section 8.7 (Accessibility & Low-Literacy Design).

export interface SpecialtyPlainInfo {
  plainName: string;
  tagalogName: string;
  description: string;
  tagalogDescription: string;
}

export const SPECIALTY_PLAIN_MAP: Record<string, SpecialtyPlainInfo> = {
  'Anesthesiology': {
    plainName: 'Pain & Anesthesia Specialist',
    tagalogName: 'Pang-pampamanhid at Pagpapaginhawa ng Sakit',
    description: 'Specializes in pain relief and patient care before, during, and after surgeries.',
    tagalogDescription: 'Especialista sa pampamanhid at pagkontrol ng pananakit sa operasyon.',
  },
  'Cardiology': {
    plainName: 'Heart & Blood Vessel Specialist',
    tagalogName: 'Espesyalista sa Puso at Dugo',
    description: 'Treats chest pain, high blood pressure, heart rhythm issues, and cardiovascular health.',
    tagalogDescription: 'Gumagamot sa paninikip ng dibdib, altapresyon, palpitations, at kalusugan ng puso.',
  },
  'Dermatology': {
    plainName: 'Skin, Hair & Nail Specialist',
    tagalogName: 'Espesyalista sa Balat, Buhok at Kuko',
    description: 'Helps with rashes, acne, eczema, skin infections, allergies, and suspicious moles.',
    tagalogDescription: 'Tumatulong sa mga pantal, acne, pangangati, allergy sa balat, at mga sugat.',
  },
  'Emergency Medicine': {
    plainName: 'Emergency & Urgent Care Doctor',
    tagalogName: 'Doktor sa Emerhensiya at Agarang Lunas',
    description: 'Provides urgent treatment for sudden, severe illnesses and injuries.',
    tagalogDescription: 'Agarang lunas para sa mga biglaang matitinding karamdaman at aksidente.',
  },
  'Endocrinology': {
    plainName: 'Diabetes, Hormones & Thyroid Specialist',
    tagalogName: 'Espesyalista sa Diabetes, Hormones at Thyroid',
    description: 'Manages blood sugar, diabetes, thyroid disorders, and metabolism.',
    tagalogDescription: 'Gumagamot sa diabetes, problema sa thyroid, goiter, at iba pang hormones sa katawan.',
  },
  'Family Medicine': {
    plainName: 'Family & General Health Doctor',
    tagalogName: 'Doktor ng Buong Pamilya',
    description: 'Comprehensive general health care for patients of all ages, from children to seniors.',
    tagalogDescription: 'Pangkalahatang pangangalaga sa kalusugan para sa bata, matanda, at buong pamilya.',
  },
  'Gastroenterology': {
    plainName: 'Digestive, Stomach & Liver Specialist',
    tagalogName: 'Espesyalista sa Tiyan, Bituka at Atay',
    description: 'Treats acid reflux, stomach pain, bowel issues, ulcer, liver, and digestive problems.',
    tagalogDescription: 'Gumagamot sa hyperacidity, pananakit ng tiyan, pagtatae, ulcer, at atay.',
  },
  'General Practice': {
    plainName: 'General Care & Consultation',
    tagalogName: 'Pangkalahatang Konsultasyon',
    description: 'Primary checkups, common illnesses, cough, fever, and routine medical advice.',
    tagalogDescription: 'Unang pagsusuri para sa karaniwang sakit tulad ng ubo, sipon, lagnat, at reseta.',
  },
  'General Surgery': {
    plainName: 'Surgeon / Surgical Specialist',
    tagalogName: 'Espesyalista sa Pag-oopera',
    description: 'Performs surgeries for appendicitis, gallstones, hernias, lumps, and soft tissue.',
    tagalogDescription: 'Nagsasagawa ng operasyon para sa appendicitis, bato sa apdo, luslos, at bukol.',
  },
  'Geriatric Medicine': {
    plainName: 'Senior & Elderly Care Specialist',
    tagalogName: 'Espesyalista sa Kalusugan ng Matatanda / Seniors',
    description: 'Focuses on the unique healthcare needs, mobility, memory, and wellness of elderly adults.',
    tagalogDescription: 'Nakatuon sa espesyal na pangangalaga, memorya, at kalusugan ng mga nakatatanda.',
  },
  'Hematology': {
    plainName: 'Blood Health Specialist',
    tagalogName: 'Espesyalista sa Dugo',
    description: 'Treats anemia, bleeding or clotting disorders, low platelets, and blood conditions.',
    tagalogDescription: 'Gumagamot sa anemic o kulang sa dugo, madaling magkapasa, at pamumuo ng dugo.',
  },
  'Infectious Diseases': {
    plainName: 'Infection & Virus Specialist',
    tagalogName: 'Espesyalista sa Impeksyon at Mikrobyo',
    description: 'Diagnoses and treats complex infections, dengue, tuberculosis, fever of unknown origin, and viral illnesses.',
    tagalogDescription: 'Gumagamot sa dengue, TB, matagal na lagnat, at mga impeksyon dulot ng bacteria o virus.',
  },
  'Internal Medicine': {
    plainName: 'Adult Medicine Specialist',
    tagalogName: 'Espesyalista sa Sakit ng Matatanda (Internal Medicine)',
    description: 'Expert medical care for chronic and complex illnesses in adults.',
    tagalogDescription: 'Pangunahing doktor para sa mga karamdaman at pangmatagalang sakit ng mga nasa hustong gulang.',
  },
  'Nephrology': {
    plainName: 'Kidney Health Specialist',
    tagalogName: 'Espesyalista sa Bato (Kidneys)',
    description: 'Treats kidney stones, chronic kidney disease, swelling, and abnormal urine tests.',
    tagalogDescription: 'Gumagamot sa bato sa bato, pamamanas, UTI na pabalik-balik, at kalusugan ng bato.',
  },
  'Neurology': {
    plainName: 'Brain, Spine & Nerve Specialist',
    tagalogName: 'Espesyalista sa Utak, Ugat at Nerbiyos',
    description: 'Helps with frequent headaches, numbness, seizures, stroke recovery, tremors, and nerve pain.',
    tagalogDescription: 'Tumatulong sa matinding sakit ng ulo, pamamanhid, stroke, panginginig, at nerbiyos.',
  },
  'Neurosurgery': {
    plainName: 'Brain & Spine Surgeon',
    tagalogName: 'Siruhano sa Utak at Gulugod',
    description: 'Performs surgeries on the brain, spine, spinal cord, and central nervous system.',
    tagalogDescription: 'Nagsasagawa ng operasyon sa utak, likod, at spinal cord.',
  },
  'Nuclear Medicine': {
    plainName: 'Diagnostic Imaging & Thyroid Therapy',
    tagalogName: 'Espesyalista sa Nuclear Scans at Pagsusuri',
    description: 'Uses specialized safe scans for organ function, bone scans, and thyroid radioactive iodine therapy.',
    tagalogDescription: 'Gumagamit ng espesyal na scan upang suriin ang galaw ng mga organo at thyroid.',
  },
  'Obstetrics and Gynecology': {
    plainName: "Women's Health, OB-GYN & Pregnancy",
    tagalogName: 'Doktor sa Panganganak at Kalusugan ng Kababaihan (OB-GYN)',
    description: 'Care for pregnancy, childbirth, menstruation issues, PCOS, and female reproductive health.',
    tagalogDescription: 'Pangangalaga sa pagbubuntis, panganganak, regla, PCOS, at kalusugan ng babae.',
  },
  'Occupational Medicine': {
    plainName: 'Workplace & Occupational Health',
    tagalogName: 'Kalusugan sa Trabaho at Fit-to-Work',
    description: 'Provides fit-to-work clearances, workplace injury management, and employee health.',
    tagalogDescription: 'Fit-to-work clearance at pagsusuri para sa kaligtasan sa pinapasukang trabaho.',
  },
  'Ophthalmology': {
    plainName: 'Eye Specialist & Eye Surgeon',
    tagalogName: 'Espesyalista sa Mata (Pang-mata)',
    description: 'Treats blurry vision, cataracts, glaucoma, eye redness, eye pain, and vision correction.',
    tagalogDescription: 'Gumagamot sa malabong mata, katarata, glaucoma, pamumula, at pananakit ng mata.',
  },
  'Orthopedics': {
    plainName: 'Bones, Joints & Muscle Specialist',
    tagalogName: 'Espesyalista sa Buto, Kasukasuan at Muscle',
    description: 'Helps with fractures, arthritis, joint pain, back pain, sports injuries, and spine conditions.',
    tagalogDescription: 'Tumatulong sa bali, rayuma, pananakit ng tuhod, likod, at kasukasuan.',
  },
  'Otolaryngology': {
    plainName: 'Ear, Nose & Throat (ENT) Specialist',
    tagalogName: 'Espesyalista sa Tainga, Ilong at Lalamunan (ENT)',
    description: 'Treats hearing problems, ear infections, sinus issues, sore throat, hoarseness, and tonsils.',
    tagalogDescription: 'Gumagamot sa problema sa pandinig, sinusitis, pananakit ng lalamunan, at tonsil.',
  },
  'Pain Medicine': {
    plainName: 'Chronic Pain Relief Specialist',
    tagalogName: 'Espesyalista sa Pamamahala ng Matinding Sakit',
    description: 'Helps relieve chronic nerve pain, back pain, and long-lasting body discomfort.',
    tagalogDescription: 'Tumatulong magpaginhawa ng matagal at matinding pananakit ng katawan.',
  },
  'Pathology': {
    plainName: 'Laboratory & Diagnostic Pathology',
    tagalogName: 'Espesyalista sa Laboratory at Pagsusuri ng Tissue',
    description: 'Analyzes blood tests, biopsies, and tissue samples to accurately identify diseases.',
    tagalogDescription: 'Nagsusuri ng biopsy at mga laboratory test upang matukoy ang sakit.',
  },
  'Pediatrics': {
    plainName: 'Child & Baby Specialist (Pedia)',
    tagalogName: 'Doktor ng mga Bata at Sanggol (Pambata)',
    description: 'Comprehensive health care, growth monitoring, immunizations, and illnesses in infants, children, and teens.',
    tagalogDescription: 'Pangangalaga sa kalusugan, bakuna, at sakit ng mga sanggol, bata, at tinedyer.',
  },
  'Physical Medicine and Rehabilitation': {
    plainName: 'Physical Therapy & Rehab Specialist (Physiatrist)',
    tagalogName: 'Espesyalista sa Rehab, Pagkilos at Physical Therapy',
    description: 'Restores movement, function, and strength after stroke, injuries, surgeries, or chronic pain.',
    tagalogDescription: 'Tumutulong maibalik ang lakas at normal na pagkilos pagkatapos ng stroke o pinsala.',
  },
  'Plastic Surgery': {
    plainName: 'Reconstructive & Plastic Surgeon',
    tagalogName: 'Siruhano sa Rekonstruksyon at Balat',
    description: 'Performs reconstructive surgery for burns, scars, wound repair, and aesthetic enhancements.',
    tagalogDescription: 'Pag-aayos ng sugat, peklat, paso, at pagpapaganda ng anyo.',
  },
  'Psychiatry': {
    plainName: 'Mental Health & Emotional Wellness Doctor',
    tagalogName: 'Espesyalista sa Kalusugang Pangkaisipan at Emosyon',
    description: 'Provides medical evaluation and treatment for anxiety, depression, sleep issues, and mental health.',
    tagalogDescription: 'Tumatulong sa labis na pagkabalisa (anxiety), kalungkutan (depression), at tulog.',
  },
  'Pulmonology': {
    plainName: 'Lungs, Chest & Breathing Specialist',
    tagalogName: 'Espesyalista sa Baga at Paghinga',
    description: 'Treats asthma, chronic cough, pneumonia, shortness of breath, and lung conditions.',
    tagalogDescription: 'Gumagamot sa hika, matagal na ubo, pulmonya, at hirap sa paghinga.',
  },
  'Radiation Oncology': {
    plainName: 'Radiation Cancer Therapy Specialist',
    tagalogName: 'Espesyalista sa Radiation Therapy para sa Kanser',
    description: 'Treats cancer using targeted radiation therapy.',
    tagalogDescription: 'Gumagamot ng bukol at kanser sa pamamagitan ng radiation treatment.',
  },
  'Radiology': {
    plainName: 'X-ray, Ultrasound, CT & MRI Specialist',
    tagalogName: 'Espesyalista sa X-ray, Ultrasound at CT Scan',
    description: 'Interprets medical imaging such as X-rays, Ultrasounds, CT scans, and MRIs.',
    tagalogDescription: 'Nagbabasa at nagpapaliwanag ng resulta ng X-ray, Ultrasound, at scan.',
  },
  'Rheumatology': {
    plainName: 'Arthritis & Autoimmune Specialist',
    tagalogName: 'Espesyalista sa Rayuma, Gout at Kasukasuan',
    description: 'Treats gout, rheumatoid arthritis, joint inflammation, lupus, and autoimmune disorders.',
    tagalogDescription: 'Gumagamot sa gout, rayuma, pamamaga ng kasukasuan, at lupus.',
  },
  'Urology': {
    plainName: 'Urinary & Male Reproductive Specialist',
    tagalogName: 'Espesyalista sa Pag-ihi, Bato sa Pantog at Prostate',
    description: 'Treats urinary tract infections, kidney/bladder stones, and prostate health.',
    tagalogDescription: 'Gumagamot sa hirap sa pag-ihi, bato sa pantog, at kalusugan ng prostate.',
  },
};

/**
 * Returns a friendly, plain-language description for a medical specialty.
 */
export function getPlainSpecialtyInfo(specialty: string): SpecialtyPlainInfo {
  const match = SPECIALTY_PLAIN_MAP[specialty];
  if (match) return match;

  // Fallback if not found
  return {
    plainName: `${specialty} Specialist`,
    tagalogName: `Espesyalista sa ${specialty}`,
    description: `Specialized medical care and clinical consultation for ${specialty}.`,
    tagalogDescription: `Espesyalistang pangangalagang medikal para sa ${specialty}.`,
  };
}
