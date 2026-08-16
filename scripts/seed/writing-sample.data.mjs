// AlmiDET — Writing Sample: 11 authored prompts (Cowork content). Reference item lives in the repo seed.
// Shape matches CC's scaffolded reference:
//   { category, topic, prompt, targetWords, rubric:{traits, reference} }
// category ∈ {academic, personal}. prompt must be readable in ~30s (kept short). targetWords constant. reference = server-only anchor.
// (practiceNote is supplied by the projector/composer, not per item.)

const TRAITS = ["Task response", "Coherence & organisation", "Vocabulary range", "Grammatical accuracy"];
const ws = (title, level, category, topic, prompt, reference) => ({
  title, level, category, topic, prompt,
  targetWords: "100–130+",
  rubric: { traits: TRAITS, reference },
});

export const ITEMS = [
  ws("A special place", "FOUNDATION", "personal", "Places",
    "Describe a place that is special to you. Explain where it is, what it is like, and why it matters to you.",
    "Describes a specific place with some sensory detail and gives a clear personal reason it matters; coherent, ~100–130 words."),

  ws("Someone who influenced you", "FOUNDATION", "personal", "People",
    "Write about a person who has influenced your life. Who are they, and what have they taught you?",
    "Introduces a specific person and develops one or two concrete lessons or effects with examples; coherent, ~100–130 words."),

  ws("A five-year goal", "FOUNDATION", "personal", "Goals",
    "What is a goal you hope to achieve in the next five years? Explain the goal and the steps you will take to reach it.",
    "States a specific goal and outlines realistic steps with reasons; forward-looking conclusion; ~100–130 words."),

  ws("Choose a career early?", "CORE", "academic", "Careers",
    "Some people believe students should choose their career path early; others think they should keep their options open. Which do you agree with, and why?",
    "Clear thesis choosing a side, two developed reasons with examples, brief conclusion; academic register; ~100–130 words."),

  ws("Free public transport", "CORE", "academic", "Society",
    "Should public transport be free for everyone? Give your opinion and support it with clear reasons.",
    "Direct thesis, two supported reasons (each with an example or consequence), short conclusion; ~100–130 words."),

  ws("A challenge you overcame", "CORE", "personal", "Experience",
    "Describe a challenge you overcame. What was the challenge, what did you do, and what did you learn from it?",
    "Narrates a specific challenge, the action taken, and a clear lesson; coherent arc; ~100–130 words."),

  ws("Too reliant on smartphones?", "CORE", "academic", "Technology",
    "Do you agree that people rely too much on smartphones today? Explain your position with examples.",
    "Takes a clear position with two example-backed reasons and a brief conclusion; ~100–130 words."),

  ws("Studying abroad and culture", "STRETCH", "academic", "Culture",
    "Some argue that studying abroad is the best way to understand another culture. To what extent do you agree?",
    "States a nuanced degree of agreement, defends it with two developed points, acknowledges a limit; academic register; ~100–130 words."),

  ws("Libraries or school technology", "STRETCH", "academic", "Public spending",
    "Governments should invest more in public libraries than in new technology for schools. Do you agree or disagree?",
    "Clear position weighing the trade-off, two reasoned points with examples, and a concession or conclusion; ~100–130 words."),

  ws("Well paid or meaningful work", "STRETCH", "academic", "Work & values",
    "Is it more important for work to be well paid or personally meaningful? Defend your view.",
    "Defends a clear priority with two developed reasons, concedes the other value's worth, and concludes; ~100–130 words."),

  ws("Change one thing about your education", "STRETCH", "personal", "Education",
    "If you could change one thing about the education you received, what would it be and why?",
    "Names one specific change, explains the problem it fixes with personal examples, and its expected benefit; ~100–130 words."),
];

export default ITEMS;
