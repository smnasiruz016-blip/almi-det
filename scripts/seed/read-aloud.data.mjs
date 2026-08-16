// AlmiDET — Read Aloud: 18 authored sentences (Cowork content). Task: the test-taker says the sentence aloud;
// the recording is transcribed and scored against this KNOWN target text (objective — no hidden key).
// Shape: { title, level, text }.  6 per level, rising phonological difficulty.

const ra = (title, level, text) => ({ title, level, text });

export const ITEMS = [
  // FOUNDATION — short, common words, simple phonology
  ra("Park after school", "FOUNDATION", "The children played happily in the park after school."),
  ra("Bread and milk", "FOUNDATION", "She bought some fresh bread and milk from the market."),
  ra("Hospital by the river", "FOUNDATION", "My brother works at a small hospital near the river."),
  ra("A film together", "FOUNDATION", "We watched an interesting film together last weekend."),
  ra("Warm and sunny", "FOUNDATION", "The weather was warm and sunny throughout the holiday."),
  ra("Coffee before work", "FOUNDATION", "He always drinks a cup of coffee before starting work."),

  // CORE — longer clauses, consonant clusters, multi-syllable words
  ra("Postpone the meeting", "CORE", "The committee agreed to postpone the meeting until Thursday afternoon."),
  ra("Exercise and mood", "CORE", "Regular exercise can significantly improve both mood and concentration."),
  ra("Modern architecture", "CORE", "The museum's newest exhibition explores the history of modern architecture."),
  ra("Traffic to the airport", "CORE", "Despite the heavy traffic, they arrived at the airport on time."),
  ra("Reducing plastic waste", "CORE", "Scientists are developing new methods to reduce plastic waste."),
  ra("Renewable energy", "CORE", "Her presentation clearly explained the advantages of renewable energy."),

  // STRETCH — abstract vocabulary, dense phrasing, harder phonology
  ra("Perseverance and preparation", "STRETCH", "The entrepreneur attributed her success to perseverance and thorough preparation."),
  ra("Redesigned packaging", "STRETCH", "Environmental regulations have prompted manufacturers to redesign their packaging."),
  ra("An unexplained phenomenon", "STRETCH", "The phenomenon remains largely unexplained despite decades of rigorous research."),
  ra("Collapsed negotiations", "STRETCH", "Negotiations collapsed when neither delegation would compromise on tariffs."),
  ra("Consequences of isolation", "STRETCH", "Contemporary literature frequently examines the psychological consequences of isolation."),
  ra("Catalogued artefacts", "STRETCH", "The archaeologists meticulously catalogued each artefact they unearthed."),
];

export default ITEMS;
