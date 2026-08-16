// AlmiDET — Listen Then Speak: HEAR a spoken question, then speak up to 90s. AI-graded from the transcript.
// The question is delivered as AUDIO only — `question` is SERVER-ONLY (TTS source + rater context); the client
// never receives the question text, only its rendered clip (seg "question"). reference is SERVER-ONLY.
// Shape: { title, level, question, rubric:{traits, reference} }.
const T = ["Task relevance & development", "Fluency & coherence", "Vocabulary range", "Grammatical accuracy"];
const q = (title, level, question, reference) => ({ title, level, question, rubric: { traits: T, reference } });

export const ITEMS = [
  q("Last weekend", "FOUNDATION", "What did you do last weekend? Describe what you did and who you were with.",
    "Answers the actual question with specific past-tense detail about activities and people; fluent for most of the time."),
  q("Your hometown", "FOUNDATION", "Tell me about your hometown. What is it like, and what do you enjoy about it?",
    "Describes the hometown with a couple of concrete features and a personal reason for enjoying it; coherent."),
  q("Music you like", "FOUNDATION", "What kind of music do you like, and why do you enjoy it?",
    "Names a type of music and gives one or two genuine reasons with some detail; on-topic and reasonably fluent."),
  q("Morning or evening study", "CORE", "Do you prefer studying in the morning or in the evening? Explain your reasons.",
    "States a clear preference and supports it with two reasons or examples; coherent, with some range."),
  q("Something to learn", "CORE", "Describe something you would like to learn in the future and explain why it interests you.",
    "Names a specific thing to learn and gives a developed reason for the interest; fluent and connected."),
  q("Change your routine", "CORE", "What is one thing you would change about your daily routine, and why?",
    "Identifies a specific change and explains the benefit clearly; coherent, with varied vocabulary."),
  q("Early second language", "CORE", "Do you think children should learn a second language at an early age? Why or why not?",
    "Takes a clear position with two supporting reasons and an example; developed and fluent."),
  q("Home or office work", "STRETCH", "Some people say working from home is better than working in an office. What do you think, and why?",
    "Argues a clear view with two developed reasons, concedes one advantage of the other side; fluent and precise."),
  q("A challenge for young people", "STRETCH", "Describe a challenge many young people face today, and suggest how it could be addressed.",
    "Names a specific challenge, explains why it matters, and proposes a realistic response; coherent and detailed."),
  q("Successful or happy at work", "STRETCH", "Is it more important to be successful or to be happy in your work? Explain your view.",
    "Defends a clear priority with two reasons, acknowledges the other value, and concludes; fluent with range."),
  q("How communication changed", "STRETCH", "How has the way people communicate changed in recent years, and is it for the better?",
    "Describes concrete changes and takes a judged position on whether they are positive, with examples; developed."),
  q("A book or film", "CORE", "Talk about a book, film, or show that made an impression on you, and explain why.",
    "Names a specific work and explains its impact with concrete detail; coherent and reasonably fluent."),
];
export default ITEMS;
