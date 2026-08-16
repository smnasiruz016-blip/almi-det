// AlmiDET — Speaking Sample: read a written question, then speak up to 3 minutes.
// In the real DET this is UNSCORED and sent to institutions; in our PRACTICE product we AI-grade it for feedback,
// with the same kind of on-screen note as Writing Sample (the projector supplies the canonical practice note).
// Shape: { title, level, category, prompt, rubric:{traits, reference} }. prompt SHOWN; reference SERVER-ONLY.
const T = ["Task relevance & development", "Fluency & coherence", "Vocabulary range", "Grammatical accuracy"];
const s = (title, level, category, prompt, reference) => ({ title, level, category, prompt, rubric: { traits: T, reference } });

export const ITEMS = [
  s("A lesson learned", "FOUNDATION", "personal", "Describe an experience that taught you something important. What happened, and what did you learn from it?",
    "Narrates a specific experience with a clear beginning, middle, and end, and states a genuine lesson; sustained and coherent over the long turn."),
  s("A goal you pursue", "FOUNDATION", "personal", "Talk about a goal you are working towards. Why is it important to you, and how are you pursuing it?",
    "Names a specific goal, explains why it matters, and describes concrete steps; developed and fluent across the time."),
  s("A positive influence", "FOUNDATION", "personal", "Describe someone who has had a positive influence on your life, and explain how.",
    "Introduces a specific person, describes their qualities, and gives concrete examples of their influence; coherent and detailed."),
  s("Practical vs academic", "CORE", "academic", "Do you think schools should focus more on practical skills than on academic subjects? Explain your view.",
    "Takes a clear position, develops two or three reasons with examples, acknowledges a counterpoint, and concludes; sustained and organised."),
  s("Social media's effect", "CORE", "academic", "Some believe social media does more harm than good. Discuss your opinion with reasons and examples.",
    "States a clear opinion, supports it with developed reasons and real examples, and weighs the other side; coherent over three minutes."),
  s("An important place", "CORE", "personal", "Describe a place that is important to you, and explain why it matters.",
    "Describes a specific place vividly and explains its personal significance with detail; sustained and coherent."),
  s("Free higher education", "CORE", "academic", "Should higher education be free for everyone? Give your opinion and support it.",
    "Argues a clear position with developed reasons and an example or consequence, and addresses a trade-off; organised and fluent."),
  s("Responsibility for the environment", "STRETCH", "academic", "To what extent should individuals be responsible for protecting the environment? Discuss.",
    "Sets out a nuanced position, develops it with reasoning and examples, weighs individual against collective action; sophisticated and sustained."),
  s("Connected or isolated", "STRETCH", "academic", "Is technology making people more connected or more isolated? Explain your position with examples.",
    "Takes a judged position, develops both sides with concrete examples, and defends a conclusion; coherent and precise over the long turn."),
  s("Studying abroad", "STRETCH", "academic", "Some argue studying abroad is more valuable than studying at home. Do you agree?",
    "States a degree of agreement, develops reasons with examples, acknowledges the value of the alternative, and concludes; sustained and varied."),
  s("Advice to your younger self", "STRETCH", "personal", "If you could give one piece of advice to your younger self, what would it be, and why?",
    "Names specific advice, explains the reasoning with personal examples, and reflects on its expected effect; coherent and developed."),
  s("A community problem", "CORE", "academic", "Describe a problem in your community and suggest realistic ways it could be solved.",
    "Identifies a specific problem, explains its impact, and proposes realistic solutions with reasoning; organised over the long turn."),
];
export default ITEMS;
