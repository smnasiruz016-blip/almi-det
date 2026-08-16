// AlmiDET — Read Then Speak: read a written question, then speak up to 90s. AI-graded from the transcript.
// Shape: { title, level, prompt, rubric:{traits, reference} }. prompt is SHOWN (the task); reference is SERVER-ONLY.
const T = ["Task relevance & development", "Fluency & coherence", "Vocabulary range", "Grammatical accuracy"];
const q = (title, level, prompt, reference) => ({ title, level, prompt, rubric: { traits: T, reference } });

export const ITEMS = [
  q("Favourite weekend", "FOUNDATION", "Describe your favourite way to spend a weekend. What do you do, and who do you spend it with?",
    "Names a clear weekend activity, adds who and why with a few specific details, and keeps talking coherently for most of the time."),
  q("A place to visit", "FOUNDATION", "Talk about a place you would like to visit one day. Why do you want to go there?",
    "Names a specific place and gives two reasons for wanting to go, with some detail; fluent and on-topic."),
  q("A meal you enjoy", "FOUNDATION", "Describe a meal you enjoy cooking or eating. What is in it, and why do you like it?",
    "Describes a specific meal, its main components, and a personal reason for liking it, with reasonable fluency."),
  q("A person you admire", "CORE", "Describe a person you admire. What qualities do they have, and how have they influenced you?",
    "Identifies a specific person, names two qualities with examples, and explains a concrete influence; connected and fluent."),
  q("Plan or be spontaneous", "CORE", "Some people plan everything in advance; others like to be spontaneous. Which are you, and why?",
    "States a clear preference with two reasons or examples and acknowledges the trade-off; coherent and varied."),
  q("A useful technology", "CORE", "Talk about a piece of technology you find useful in daily life. How has it changed how you do things?",
    "Names a specific technology and explains a concrete before-and-after change with detail; fluent, with varied vocabulary."),
  q("A recent skill", "CORE", "Describe a skill you have learned recently. How did you learn it, and how has it helped you?",
    "Names a specific skill, outlines how it was learned, and gives a real benefit; developed and coherent."),
  q("Team or alone", "STRETCH", "Do you think it is better to work in a team or alone? Explain your view with examples.",
    "Takes a clear position, supports it with two developed examples, concedes a limit; fluent with range and accuracy."),
  q("Dependent on the internet", "STRETCH", "Some say people today are too dependent on the internet. To what extent do you agree, and why?",
    "States a nuanced degree of agreement, defends it with specific examples, and notes a counterpoint; fluent and precise."),
  q("An important decision", "STRETCH", "Describe a decision you made that turned out to be important. What was it, and what did you learn?",
    "Narrates a specific decision, its outcome, and a clear lesson, with a coherent arc and varied language."),
  q("Public transport policy", "STRETCH", "Should governments encourage people to use public transport instead of cars? Give your opinion and reasons.",
    "Takes a clear stance with two reasoned points and an example or consequence; developed, fluent, accurate."),
  q("A change in your community", "CORE", "Talk about a change you would like to see in your community. Why does it matter, and how could it happen?",
    "Names a specific change, explains why it matters, and suggests a realistic route to it; coherent and detailed."),
];
export default ITEMS;
