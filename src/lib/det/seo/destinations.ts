// AlmiDET SEO — DET_DESTINATIONS dataset
// Shape EXACTLY per CC's DetDestination type (recon report).
// All data verified from 2026 sources. Country-level real numbers — NOT per-page fabrication.
// Where a precise count isn't verifiable, acceptanceCount uses an honest range/approx; never a fake precise number.
// CC: drop into src/lib/det/seo/destinations.ts. isDetDestination(slug) => slug in this map (these index; rest noindex).

// ============================================================
// TYPE (per CC's recon — for reference, CC already has this)
// ============================================================
// export type DetAcceptanceNote = { label: string; text: string; warn?: boolean };
// export type DetNamedUni = { name: string; detScore?: string; note?: string };
// export type DetScoreTier = { tier: string; range: string; note: string };
// export type DetDestination = {
//   acceptanceLead: string;        // count + framing
//   acceptanceCount: string;       // real number/range
//   study: { requirement: string; body: string };
//   scoreTiers?: DetScoreTier[];
//   namedUniversities?: DetNamedUni[];
//   visaNote: string;              // REQUIRED — admission≠visa honesty
//   costAngle?: string;
//   acceptance: DetAcceptanceNote[];
//   sources: { label: string; url: string }[];
// };

import { findCountry } from "./almi-data-local";
import autoRaw from "./destinations-auto.json";

// Auto-opened destinations: countries with >=5 DET-accepting institutions on
// Duolingo's official list. We index a real COUNT (honest, Duolingo-sourced) +
// general guidance — never a named list (Duolingo's program-country tagging
// can place a foreign campus under another country, so names are not shown).
export type DetAutoDestination = { count: number };
const AUTO_DESTINATIONS = autoRaw as Record<string, DetAutoDestination>;
export const AUTO_DESTINATION_SLUGS: string[] = Object.keys(AUTO_DESTINATIONS);
export const lookupAutoDestination = (slug: string): DetAutoDestination | null =>
  AUTO_DESTINATIONS[slug] ?? null;

export type DetAcceptanceNote = { label: string; text: string; warn?: boolean };
export type DetNamedUni = { name: string; detScore?: string; note?: string };
export type DetScoreTier = { tier: string; range: string; note: string };
export type DetDestination = {
  acceptanceLead: string;
  acceptanceCount: string;
  study: { requirement: string; body: string };
  scoreTiers?: DetScoreTier[];
  namedUniversities?: DetNamedUni[];
  visaNote: string;
  costAngle?: string;
  acceptance: DetAcceptanceNote[];
  sources: { label: string; url: string }[];
};

export const DET_DESTINATIONS: Record<string, DetDestination> = {

  "united-states": {
    acceptanceLead: "Around 3,000+ US institutions accept the DET, including 95% of the U.S. News Top 100 universities and all eight Ivy League schools for undergraduate admission.",
    acceptanceCount: "3,000+ institutions",
    study: {
      requirement: "Scores run on the 10–160 scale. US minimums range from ~90 at community colleges to 125+ at the most selective programs.",
      body: "Over 75% of US graduate programs with high international enrolment also accept the DET. Each university — and often each program — sets its own minimum.",
    },
    scoreTiers: [
      { tier: "Highly selective (Ivy League, top research)", range: "125+", note: "Harvard, Yale, Stanford, MIT tier" },
      { tier: "Strong universities", range: "115–125", note: "many state flagships, well-ranked privates" },
      { tier: "Mid-tier universities", range: "100–115", note: "regional universities" },
      { tier: "Community colleges / pathways", range: "90–105", note: "foundation & pathway providers" },
    ],
    namedUniversities: [
      { name: "Harvard University", detScore: "125+" },
      { name: "Yale University", detScore: "125+" },
      { name: "Stanford University", detScore: "125+" },
      { name: "Columbia University" },
      { name: "Duke University" },
    ],
    visaNote: "For the F-1 student visa, USCIS does not mandate a specific English test. Your university issues the I-20 on its own admission criteria — so if your university accepted your DET, you are covered. The consular officer assesses your spoken English at the interview in person.",
    costAngle: "At ~$70 the DET costs far less than IELTS (~$245) and is accepted across nearly all major US universities — one of the most cost-effective routes for US applications.",
    acceptance: [
      { label: "Admission", text: "Accepted at 95% of the U.S. News Top 100 and all Ivy League schools for undergrad." },
      { label: "Visa (F-1)", text: "No specific test mandated; university admission generally satisfies the visa." },
    ],
    sources: [
      { label: "Times Higher Education (Student)", url: "https://www.timeshighereducation.com/student/blogs/duolingo-english-test-accepted-countries-schools-visas" },
      { label: "goarno.io country guide", url: "https://goarno.io/blog/duolingo-english-test-acceptance-by-country" },
    ],
  },

  "canada": {
    acceptanceLead: "More than 400 Canadian universities and colleges accept the DET, including every English-speaking U15 research university.",
    acceptanceCount: "400+ institutions",
    study: {
      requirement: "Scores run on the 10–160 scale; there is no single national minimum — each university and program sets its own.",
      body: "Top universities cluster around 120–135; mid-tier 110–120; colleges and pathways 95–110.",
    },
    scoreTiers: [
      { tier: "Top research universities", range: "120–135", note: "UofT, UBC, McGill" },
      { tier: "Mid-tier universities", range: "110–120", note: "York, Dalhousie, SFU" },
      { tier: "Colleges & pathways", range: "95–110", note: "community colleges, foundation routes" },
    ],
    namedUniversities: [
      { name: "University of Toronto", detScore: "120–135" },
      { name: "University of British Columbia", detScore: "120–130" },
      { name: "McGill University", detScore: "120–130" },
    ],
    visaNote: "Canada ended the Student Direct Stream (SDS) on 8 November 2024, which used to require IELTS specifically — so older guides are out of date. Today everyone uses the regular study-permit process: if a Canadian university accepts your DET and issues a Letter of Acceptance (LOA), that's generally sufficient for the permit. Note: Permanent Residency later requires an approved immigration test (IELTS General or CELPIP) — the DET is not used for PR.",
    costAngle: "Since SDS ended, there's no longer a visa advantage to IELTS over the DET for Canadian study permits — at ~$70 vs ~$245, the DET is the cheaper route for admission.",
    acceptance: [
      { label: "Admission", text: "400+ universities and colleges; every English-speaking U15 university." },
      { label: "Study permit", text: "DET-based admission + LOA generally sufficient since SDS ended." },
      { label: "PR (later)", text: "Not used for Permanent Residency — needs IELTS General or CELPIP.", warn: true },
    ],
    sources: [
      { label: "TopUniversities", url: "https://www.topuniversities.com/student-info/admissions-advice-articles/where-duolingo-english-test-accepted" },
      { label: "goarno.io country guide", url: "https://goarno.io/blog/duolingo-english-test-acceptance-by-country" },
    ],
  },

  "united-kingdom": {
    acceptanceLead: "More than 130 UK universities accept the DET for admission, including several Russell Group institutions.",
    acceptanceCount: "130+ universities",
    study: {
      requirement: "Scores run on the 10–160 scale; most UK universities want 110–125 for taught programs, and some set minimum subscores.",
      body: "Competitive and Russell Group programs sit at 120–130+; foundation and pre-sessional routes lower.",
    },
    scoreTiers: [
      { tier: "Competitive / Russell Group", range: "120–130+", note: "Imperial, Bristol, Birmingham" },
      { tier: "Most taught programs", range: "110–125", note: "wide range of universities" },
      { tier: "Foundation / pre-sessional", range: "90–105", note: "pathway & foundation routes" },
    ],
    namedUniversities: [
      { name: "Imperial College London", detScore: "120–130+" },
      { name: "University of Bristol", detScore: "115–125" },
      { name: "University of Glasgow" },
      { name: "University of York" },
    ],
    visaNote: "Important: the DET is accepted for UK university ADMISSION but is NOT on the UK Home Office's approved Secure English Language Test (SELT) list, so it cannot serve as a standalone SELT for the student visa. Many universities (especially post-1992) assess English internally and issue a CAS that enables the visa without a separate SELT — if a university says its DET offer 'covers visa requirements', confirm that in writing with admissions. For most students, IELTS for UKVI remains the standard visa route.",
    costAngle: "The DET (~$70) secures a UK admission offer cheaply; budget separately for IELTS UKVI (~£200) only if your specific university requires a SELT for the visa.",
    acceptance: [
      { label: "Admission", text: "130+ universities including Russell Group members." },
      { label: "Visa (SELT)", text: "Not on the UKVI SELT list — not a standalone visa test.", warn: true },
    ],
    sources: [
      { label: "Leap Scholar (UK)", url: "https://leapscholar.com/blog/duolingo-accepted-universities-in-uk/" },
      { label: "Gradding", url: "https://www.gradding.com/blog/duolingo/accepted-countries" },
    ],
  },

  "ireland": {
    acceptanceLead: "Ireland has near-universal acceptance — 15 of its 18 universities recognise the DET, and it is officially accepted by Irish student visa authorities.",
    acceptanceCount: "15 of 18 universities",
    study: {
      requirement: "Scores run on the 10–160 scale; requirements vary by university and program, generally 105–125.",
      body: "One of the few destinations where the DET works for both admission AND the student visa.",
    },
    scoreTiers: [
      { tier: "Top universities", range: "115–125", note: "Trinity College Dublin, UCD" },
      { tier: "Most programs", range: "105–120", note: "wide range" },
      { tier: "Foundation / pathways", range: "95–105", note: "pathway routes" },
    ],
    namedUniversities: [
      { name: "Trinity College Dublin", detScore: "115–125" },
      { name: "University College Dublin", detScore: "110–120" },
      { name: "University of Limerick" },
    ],
    visaNote: "Ireland is one of the most DET-friendly destinations: the test is officially recognised by Irish student visa authorities, so it works for both admission AND the student visa — simpler than the UK.",
    costAngle: "Because Ireland accepts the DET for both admission and visa, the ~$70 DET can fully replace a ~$245 IELTS for most Irish applications — a genuine end-to-end saving.",
    acceptance: [
      { label: "Admission", text: "15 of 18 universities accept the DET." },
      { label: "Visa", text: "Officially recognised by Irish student visa authorities." },
    ],
    sources: [
      { label: "Times Higher Education (Student)", url: "https://www.timeshighereducation.com/student/blogs/duolingo-english-test-accepted-countries-schools-visas" },
      { label: "Mastersportal", url: "https://www.mastersportal.com/articles/3494/duolingo-english-test-accepted-universities-list.html" },
    ],
  },

  "germany": {
    acceptanceLead: "A growing number of German universities accept the DET for English-taught programs, including TU Munich and RWTH Aachen.",
    acceptanceCount: "growing list (English-taught programs)",
    study: {
      requirement: "Scores run on the 10–160 scale; English-taught programs generally want 105–125. Acceptance is at the program level.",
      body: "German-taught programs require separate German-language proof.",
    },
    scoreTiers: [
      { tier: "Leading universities (English-taught)", range: "110–125", note: "TUM, RWTH Aachen" },
      { tier: "Most English-taught programs", range: "105–120", note: "various" },
    ],
    namedUniversities: [
      { name: "Technical University of Munich (TUM)" },
      { name: "RWTH Aachen University" },
      { name: "LMU Munich" },
    ],
    visaNote: "For German student-visa processing, English-language proof ties to the university's admissions decision rather than a nationally mandated test type. If your English-taught program admits you on a DET score, that admission generally supports the visa. German-taught programs need German proof separately.",
    costAngle: "Germany pairs low/no tuition with growing DET acceptance for English-taught programs — combining the ~$70 DET with affordable German universities is one of the cheapest study-abroad routes overall.",
    acceptance: [
      { label: "Admission", text: "Growing acceptance for English-taught programs (TUM, RWTH Aachen)." },
      { label: "Visa", text: "Ties to university admission decision; no national test mandate." },
    ],
    sources: [
      { label: "visatocampus.com", url: "https://visatocampus.com/duolingo-english-test-2026-scores-acceptance-guide/" },
      { label: "Leap Scholar (Europe)", url: "https://leapscholar.com/blog/duolingo-accepted-universities-in-europe/" },
    ],
  },

  "australia": {
    acceptanceLead: "More than 90 Australian universities accept the DET for undergraduate and postgraduate programs, with acceptance growing.",
    acceptanceCount: "90+ universities",
    study: {
      requirement: "Scores run on the 10–160 scale; program-specific requirements generally 95–125.",
      body: "Some universities accept the DET for all programs; others only for foundation courses.",
    },
    scoreTiers: [
      { tier: "Leading universities", range: "115–125", note: "ANU and Group of Eight (program-dependent)" },
      { tier: "Many universities (all programs)", range: "110–120", note: "Flinders, Newcastle" },
      { tier: "Foundation courses", range: "95–110", note: "e.g. Monash foundation" },
    ],
    namedUniversities: [
      { name: "Australian National University (ANU)" },
      { name: "University of Newcastle" },
      { name: "Flinders University" },
    ],
    visaNote: "Australian universities increasingly accept the DET for admission, but the student-visa English requirement is nationality- and category-dependent: some applicants must provide a test taken at a physical centre, others are exempt. The DET is not a guaranteed standalone for the visa — check your visa category and nationality-specific rules.",
    costAngle: "The DET (~$70) is great for an Australian admission offer; confirm whether your visa category needs a centre-based test (like IELTS) separately before relying on it end-to-end.",
    acceptance: [
      { label: "Admission", text: "90+ universities; some all-program, some foundation-only." },
      { label: "Visa", text: "Nationality-dependent; at-home tests not always accepted.", warn: true },
    ],
    sources: [
      { label: "Times Higher Education (Student)", url: "https://www.timeshighereducation.com/student/blogs/duolingo-english-test-accepted-countries-schools-visas" },
      { label: "goarno.io country guide", url: "https://goarno.io/blog/duolingo-english-test-acceptance-by-country" },
    ],
  },

  "new-zealand": {
    acceptanceLead: "New Zealand's universities recognise the DET for many undergraduate and postgraduate programs.",
    acceptanceCount: "all 8 universities (program-dependent)",
    study: {
      requirement: "Scores run on the 10–160 scale; recognition is program-dependent, generally 105–125.",
      body: "For the fee-paying student visa, separate English proof is generally not required if your institution accepts you.",
    },
    scoreTiers: [
      { tier: "Leading universities", range: "115–125", note: "Auckland, Otago" },
      { tier: "Most programs", range: "105–120", note: "various" },
    ],
    namedUniversities: [
      { name: "University of Auckland" },
      { name: "University of Otago" },
      { name: "Victoria University of Wellington" },
    ],
    visaNote: "For New Zealand's fee-paying student visa (up to four years), separate English proof is generally not required if your institution has accepted you — including on a DET score. Confirm with the institution and current Immigration NZ rules.",
    costAngle: "If your NZ institution accepts the DET, the visa typically needs no separate English test — making the ~$70 DET a genuine end-to-end option for many NZ applications.",
    acceptance: [
      { label: "Admission", text: "Recognised across NZ universities, program-dependent." },
      { label: "Visa", text: "No separate English proof generally needed if admitted." },
    ],
    sources: [
      { label: "TopUniversities", url: "https://www.topuniversities.com/student-info/admissions-advice-articles/where-duolingo-english-test-accepted" },
      { label: "goarno.io country guide", url: "https://goarno.io/blog/duolingo-english-test-acceptance-by-country" },
    ],
  },

  "france": {
    acceptanceLead: "More than 200 French institutions accept the DET, primarily for English-taught programs at business schools and universities.",
    acceptanceCount: "200+ institutions",
    study: {
      requirement: "Scores run on the 10–160 scale; English-taught programs generally want 105–120.",
      body: "Acceptance is concentrated in English-taught programs and is program-specific.",
    },
    scoreTiers: [
      { tier: "English-taught programs", range: "105–120", note: "business schools, international programs" },
    ],
    namedUniversities: [
      { name: "(English-taught programs at major universities & business schools — confirm per program)" },
    ],
    visaNote: "For English-taught programs in France, English proof generally ties to the program's admission decision. French-taught programs require French-language proof separately. Check your specific program and current French student-visa rules.",
    costAngle: "For English-taught French programs, the ~$70 DET is a low-cost way to meet the English requirement versus ~$245 IELTS.",
    acceptance: [
      { label: "Admission", text: "200+ institutions, mainly English-taught programs." },
      { label: "Visa", text: "Ties to program admission for English-taught courses." },
    ],
    sources: [
      { label: "visatocampus.com", url: "https://visatocampus.com/duolingo-english-test-2026-scores-acceptance-guide/" },
      { label: "Leap Scholar (Europe)", url: "https://leapscholar.com/blog/duolingo-accepted-universities-in-europe/" },
    ],
  },

  // ---- Europe (English-taught, program-level — verified as DET-accepting countries) ----

  "netherlands": {
    acceptanceLead: "Dutch universities show broad DET acceptance for English-taught programs, including the University of Amsterdam, Groningen, and Tilburg.",
    acceptanceCount: "broad acceptance (English-taught programs)",
    study: {
      requirement: "Scores run on the 10–160 scale; competitive programs often want 115+, most public universities 100–115.",
      body: "The Netherlands has some of the broadest English-taught program acceptance in mainland Europe.",
    },
    scoreTiers: [
      { tier: "Competitive programs", range: "115+", note: "research universities, selective business" },
      { tier: "Most public universities", range: "100–115", note: "applied sciences institutions" },
    ],
    namedUniversities: [
      { name: "University of Amsterdam" },
      { name: "University of Groningen" },
      { name: "Tilburg University" },
    ],
    visaNote: "For English-taught Dutch programs, English proof ties to the university's admission decision. Confirm current Dutch student-visa/residence-permit rules for your nationality.",
    costAngle: "The Netherlands has strong job prospects; the ~$70 DET meets the English requirement for most English-taught programs at a fraction of IELTS cost.",
    acceptance: [
      { label: "Admission", text: "Broad acceptance for English-taught programs." },
      { label: "Visa", text: "Ties to university admission; confirm per nationality." },
    ],
    sources: [
      { label: "Leap Scholar (Europe)", url: "https://leapscholar.com/blog/duolingo-accepted-universities-in-europe/" },
      { label: "visatocampus.com", url: "https://visatocampus.com/duolingo-english-test-2026-scores-acceptance-guide/" },
    ],
  },

  "italy": {
    acceptanceLead: "Italian universities including Bologna and Politecnico di Milano accept the DET for English-taught programs, and the list is expanding.",
    acceptanceCount: "growing list (English-taught programs)",
    study: {
      requirement: "Scores run on the 10–160 scale; English-taught programs generally want 100–115.",
      body: "Italy combines lower fees and living costs with growing DET acceptance.",
    },
    scoreTiers: [
      { tier: "Leading universities", range: "105–120", note: "Bologna, Politecnico di Milano" },
      { tier: "Most English-taught programs", range: "100–115", note: "various" },
    ],
    namedUniversities: [
      { name: "University of Bologna" },
      { name: "Politecnico di Milano" },
      { name: "Sapienza University of Rome" },
    ],
    visaNote: "For English-taught Italian programs, English proof ties to admission. Italian-taught programs need Italian proof separately. Confirm current Italian student-visa rules.",
    costAngle: "Italy offers some of Europe's most affordable fees; the ~$70 DET fits a low-total-cost study plan.",
    acceptance: [
      { label: "Admission", text: "Bologna, Politecnico di Milano, Sapienza and a growing list." },
      { label: "Visa", text: "Ties to admission for English-taught programs." },
    ],
    sources: [
      { label: "Leap Scholar (Europe)", url: "https://leapscholar.com/blog/duolingo-accepted-universities-in-europe/" },
      { label: "Leap Scholar (countries)", url: "https://leapscholar.com/blog/duolingo-accepted-countries-and-universities/" },
    ],
  },

  "spain": {
    acceptanceLead: "Spanish private universities and business schools, including IE University, accept the DET for English-taught programs.",
    acceptanceCount: "selected institutions (English-taught programs)",
    study: {
      requirement: "Scores run on the 10–160 scale; English-taught programs generally want 100–115.",
      body: "Acceptance is concentrated in private universities and business schools.",
    },
    scoreTiers: [
      { tier: "Private universities & business schools", range: "100–120", note: "IE University and similar" },
    ],
    namedUniversities: [
      { name: "IE University" },
    ],
    visaNote: "For English-taught Spanish programs, English proof ties to admission. Confirm current Spanish student-visa rules for your nationality.",
    costAngle: "Spain offers affordable living costs; the ~$70 DET meets the English requirement for English-taught programs cheaply.",
    acceptance: [
      { label: "Admission", text: "Private universities and business schools (e.g. IE University)." },
      { label: "Visa", text: "Ties to admission for English-taught programs." },
    ],
    sources: [
      { label: "eduvouchers (Europe)", url: "https://eduvouchers.com/blogs/students-diary/duolingo-accepted-universities-in-europe" },
      { label: "Leap Scholar (Europe)", url: "https://leapscholar.com/blog/duolingo-accepted-universities-in-europe/" },
    ],
  },

};

// NOTE: remove the "ireland-northern" placeholder line — it's a guard marker, not a real entry.
// Verified & indexable now: united-states, canada, united-kingdom, ireland, germany,
// australia, new-zealand, france, netherlands, italy, spain  (11 destinations).
// All other countries from Duolingo's ~110 list: render as country-level "accepted —
// confirm with your programme" with noindex/canonical-up until per-country data is verified.
// This batch + the country-level gate covers the destinations taking the overwhelming
// majority of international students.

export const DET_DESTINATION_SLUGS: string[] = Object.keys(DET_DESTINATIONS);
export const lookupDetDestination = (slug: string): DetDestination | null => DET_DESTINATIONS[slug] ?? null;
/** Index gate: only the verified destinations in the map are indexable. */
export const isDetDestinationIndexable = (slug: string): boolean =>
  slug in DET_DESTINATIONS || slug in AUTO_DESTINATIONS;
/** Display name + flag come from the canonical country list (almi-data-local). */
export function detDestinationName(slug: string): string { return findCountry(slug)?.name ?? slug.replace(/-/g, " "); }
export function detDestinationFlag(slug: string): string { return findCountry(slug)?.flag ?? ""; }
