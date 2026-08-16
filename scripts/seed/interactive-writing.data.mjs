// AlmiDET — Interactive Writing: 11 authored items (Cowork content). Reference item lives in the repo seed.
// Shape matches CC's scaffolded reference:
//   { topic, register, part1:{prompt,minWords}, part2:{prompt,minWords}, rubric:{traits, reference} }
// register ∈ {general, academic}. part2 must be RELATED to part1 and DIFFERENT text. reference = server-only grading anchor.

const TRAITS = ["Task response", "Coherence & organisation", "Vocabulary range", "Grammatical accuracy"];
const iw = (title, level, topic, register, p1, p2, reference) => ({
  title, level, topic, register,
  part1: { prompt: p1, minWords: 40 },
  part2: { prompt: p2, minWords: 25 },
  rubric: { traits: TRAITS, reference },
});

export const ITEMS = [
  iw("Free-time hobby", "FOUNDATION", "Hobbies", "general",
    "Describe a hobby or activity you enjoy in your free time. What is it, and why do you find it enjoyable? Give specific details.",
    "Now imagine recommending this hobby to a friend who has never tried it. What one piece of advice would you give a beginner, and what difficulty might they face at first?",
    "Names a specific hobby with two concrete reasons for enjoying it in Part 1; in Part 2 gives one clear, practical beginner tip and identifies a realistic early difficulty."),

  iw("Eat in or eat out", "FOUNDATION", "Food", "general",
    "Do you prefer eating at home or eating out at restaurants? Explain your preference with specific reasons and examples.",
    "Think about the option you did not choose. Describe one situation in which that option would actually be the better choice, and explain why.",
    "States a clear preference with two specific reasons; Part 2 fairly concedes one situation where the other option is better, with a reason."),

  iw("Getting around", "FOUNDATION", "Transport", "general",
    "How do you usually travel around your town or city — by car, public transport, bicycle, or on foot? Explain why you use this method.",
    "Suppose your usual method were unavailable for a week. Which alternative would you use instead, and what problems might you face?",
    "Explains the usual method with two reasons; Part 2 chooses a realistic alternative and names concrete problems."),

  iw("Spend or save", "FOUNDATION", "Money", "general",
    "Some people save money carefully, while others prefer to spend on experiences now. Which approach is closer to yours, and why?",
    "Describe one real benefit of the opposite approach, and explain a situation in which following it would be the wiser choice.",
    "Names the approach with two reasons; Part 2 fairly states a benefit of the opposite approach with a fitting situation."),

  iw("Devices in class", "CORE", "Technology in education", "academic",
    "Some schools give every student a tablet or laptop to use in class. Do you think this is a good idea? Give reasons and examples.",
    "Think about the position you argued in Part 1. Describe the strongest objection someone could raise against it, and suggest one way a teacher could address that objection.",
    "Takes a clear position with two developed reasons or examples; Part 2 names a real drawback and a plausible teacher-led mitigation."),

  iw("City or countryside", "CORE", "Where to live", "academic",
    "Is it better to raise a family in a big city or in the countryside? Explain your view with specific reasons.",
    "Now argue the other side: give one strong advantage of the option you did not choose, and how a family might make up for what it lacks.",
    "Clear position with two specific reasons; Part 2 concedes a genuine advantage of the other option plus a realistic compensation."),

  iw("Best way to learn a language", "CORE", "Language learning", "academic",
    "What do you think is the most effective way to learn a new language? Explain your reasoning with examples.",
    "Some people would disagree with your method. Give one reasonable objection to it, and explain how you would respond to that objection.",
    "Argues one method with two example-backed reasons; Part 2 raises a fair objection and answers it convincingly."),

  iw("Social media and communication", "CORE", "Social media", "general",
    "Has social media done more good or more harm to the way people communicate? Explain your view with specific examples.",
    "Suppose you had to defend the opposite conclusion. Give the single strongest point for that side, and one way to address its main weakness.",
    "Judges net good or harm with specific examples; Part 2 presents the strongest opposing point fairly and addresses a weakness."),

  iw("Online university study", "STRETCH", "Online learning", "academic",
    "Universities increasingly offer courses fully online. Do the benefits of online study outweigh the drawbacks for most students? Argue your position.",
    "Suppose the conclusion you reached in Part 1 became the policy for all university courses. Which single group of students would be most disadvantaged, and what one measure would you add to protect them?",
    "Weighs benefits against drawbacks and takes a defended position; Part 2 identifies a specific disadvantaged group and a concrete, targeted support measure."),

  iw("Who reduces pollution", "STRETCH", "Environment", "academic",
    "Who bears more responsibility for reducing pollution — individuals or governments? Defend your answer with clear reasoning.",
    "Grant that the other actor also matters. Explain the most important thing that actor should do, and one obstacle to achieving it.",
    "Assigns primary responsibility with a defended argument; Part 2 concedes the other actor's key duty and names a real obstacle."),

  iw("Schools and automation", "STRETCH", "Future of work", "academic",
    "As machines and software take over more jobs, should schools change what they teach? Explain what you think should change, or why it should not.",
    "Whatever you argued, name one skill that will stay valuable regardless, and explain why machines are unlikely to replace it.",
    "Takes a clear stance on curriculum change with reasons; Part 2 names a durable human skill with a sound reason it resists automation."),
];

export default ITEMS;
