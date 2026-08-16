// AlmiDET — Interactive Speaking: an adaptive-style spoken interview. A fixed, pre-authored sequence of
// short spoken questions (up to 35s each); each is delivered as AUDIO (server-only text, TTS'd per turn),
// the user speaks a response, and the whole set is AI-rated from the transcripts at the end.
// Cost-bounded: pre-authored turns, NO live question-generation. Shape:
//   { title, level, topic, register, turns:[{question, maxSeconds}], rubric:{traits, reference} }
// `question` (each turn) and rubric.reference are SERVER-ONLY; the client gets only each turn's audio clip.
const T = ["Task relevance & development", "Fluency & coherence", "Vocabulary range", "Grammatical accuracy"];
const turn = (question) => ({ question, maxSeconds: 35 });
const sc = (title, level, topic, register, questions, reference) => ({
  title, level, topic, register, turns: questions.map(turn), rubric: { traits: T, reference },
});
const REF = (extra) => `Answers each question directly and develops it with specific detail, sustains fluent and coherent speech across all four turns, shows a range of vocabulary and mostly accurate grammar, and handles the escalating questions naturally. ${extra}`;

export const ITEMS = [
  sc("Travel", "FOUNDATION", "Travel", "general", [
    "Do you enjoy travelling? Tell me about a trip you have taken.",
    "What did you enjoy most about that trip, and was there anything you disliked?",
    "Some people say travelling is the best form of education. Do you agree? Why?",
    "If you could travel anywhere next year with no limits, where would you go, and what would you do there?",
  ], REF("The later opinion and hypothetical turns should go beyond the opening description.")),

  sc("Hometown", "FOUNDATION", "Places", "general", [
    "Tell me about the place where you grew up. What is it like?",
    "What do you like most about it, and what would you change?",
    "Do you think it is better to grow up in a big city or a small town? Why?",
    "Imagine you could design the perfect neighbourhood. What would it have?",
  ], REF("Look for a shift from personal description to reasoned comparison and imagination.")),

  sc("Food", "FOUNDATION", "Food", "general", [
    "What kind of food do you enjoy eating?",
    "Do you like cooking, or do you prefer eating out? Explain.",
    "Some people say home-cooked food is always better than restaurant food. Do you agree?",
    "If you opened a small restaurant, what kind of food would you serve, and why?",
  ], REF("The opinion and hypothetical turns should show reasoning, not just preference.")),

  sc("Technology", "CORE", "Technology", "general", [
    "How often do you use the internet, and what do you use it for?",
    "Has technology made your daily life easier or more stressful? Give examples.",
    "Some people think we spend too much time on our phones. What is your view?",
    "What is one piece of technology you think will change the world in the next ten years?",
  ], REF("Expect concrete examples and a defended opinion in the middle turns.")),

  sc("Education", "CORE", "Education", "academic", [
    "Tell me about a subject you enjoyed studying at school.",
    "What makes a teacher effective, in your opinion?",
    "Do you think exams are a fair way to measure a student's ability? Why or why not?",
    "If you could redesign the school system, what is the first thing you would change?",
  ], REF("The argument turns should weigh reasons; academic register is appropriate.")),

  sc("Work", "CORE", "Work", "general", [
    "What kind of job would you like to have, or do you have now?",
    "What matters more to you in a job: good pay or enjoyable work? Explain.",
    "Some people believe working from home is the future. Do you agree?",
    "Imagine you could start any business you wanted. What would it be, and why?",
  ], REF("Look for a clear value judgement in turn two and reasoning throughout.")),

  sc("Health", "CORE", "Health", "general", [
    "What do you do to stay healthy?",
    "Do you find it easy or difficult to keep healthy habits? Why?",
    "Some people say governments should do more to encourage healthy living. Do you agree?",
    "If you could give one piece of health advice to everyone, what would it be?",
  ], REF("The policy and advice turns should move beyond personal routine to reasoning.")),

  sc("Environment", "STRETCH", "Environment", "academic", [
    "How concerned are you about environmental problems?",
    "What is one environmental issue that affects your area, and how?",
    "Who should be most responsible for protecting the environment — individuals, companies, or governments? Why?",
    "If you were in charge of environmental policy, what would be your first priority?",
  ], REF("Expect a defended allocation of responsibility and a concrete priority; sophisticated register.")),

  sc("News & media", "STRETCH", "Media", "academic", [
    "How do you usually keep up with news and current events?",
    "Do you think the way people get news has changed for the better? Explain.",
    "Some argue that social media spreads more misinformation than truth. What is your view?",
    "How would you teach young people to tell reliable information from unreliable information?",
  ], REF("The evaluation and how-to turns should show nuanced reasoning and specifics.")),

  sc("The future", "STRETCH", "Society", "academic", [
    "How do you think daily life will be different in twenty years?",
    "Which change do you think will have the biggest impact, and why?",
    "Are you optimistic or pessimistic about the future? Explain your reasons.",
    "If you could solve one global problem in your lifetime, which would you choose, and how?",
  ], REF("Expect a prioritised prediction and a reasoned stance, developed with examples.")),
];
export default ITEMS;
