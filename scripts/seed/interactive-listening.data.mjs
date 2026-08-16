// AlmiDET — Interactive Listening: 11 authored scenarios (Cowork content).
// Shape matches the reference item CC scaffolded:
//   scenario: { register, setting, speakerName, youAre }
//   complete: { seg:"scenario", text:[ string | {missing, alsoAccept?} ] }   (3-4 whole-word blanks)
//   turns: [ { seg, opener?, line, options:[...], correct } ]  (turn 1 = opener, seg:null, line:null)
//   summarize: { prompt, reference, keyPoints:[...] }           (reference/keyPoints are SERVER-ONLY)
// Authoring convention: options[correct] is written at index 0 here; the projector shuffles per turn.
// A blank({...}) helper marks a gap; a plain string is literal audio text.

const B = (missing, alsoAccept) => ({ missing, ...(alsoAccept ? { alsoAccept } : {}) });
const SUM = "In your own words, summarize the conversation you just had.";

export const SCENARIOS = [
  // ============================ EASY ============================
  { title: "Misdelivered package", level: "EASY",
    scenario: { register: "casual", setting: "At the front door of your apartment building", speakerName: "Priya", youAre: "Jordan" },
    complete: { seg: "scenario", text: [
      "Hi Jordan, it's Priya from apartment nine. A ", B("delivery"), " driver left a big ", B("box"),
      " with me by mistake this morning — it's got your ", B("name"),
      " on it. I'll be home after six today, so knock whenever you're free. It's a little ", B("heavy"),
      ", so bring a friend if you can. See you later!" ] },
    turns: [
      { seg: null, opener: true, line: null, correct: 0, options: [
        "Hi Priya, thanks for holding onto my package — is now an okay time to grab it?",
        "You really ought to be a lot more careful about accepting other people's mail without asking.",
        "Do you happen to know when the next building meeting is scheduled?" ] },
      { seg: "turn-2", line: "Hi! Yes, come in — it's right here by the door. Do you need a hand carrying it down?", correct: 0, options: [
        "No thanks, I think I can manage the weight on my own, but it would really help if you could just hold the door open while I lift it.",
        "Actually, I think this box belongs to someone else entirely.",
        "I honestly haven't ordered a single thing online in months, so this is a real surprise." ] },
      { seg: "turn-3", line: "Of course. By the way, the driver said he'd try your buzzer next time instead. That okay?", correct: 0, options: [
        "Yes, that's perfect — my buzzer works fine, so that'll save you the trouble.",
        "No, I'd honestly rather you just kept taking all of my parcels from now on.",
        "The elevator has been broken since last Tuesday." ] },
      { seg: "turn-4", line: "Great. Oh, there's a smaller envelope too — it came the same day. Want both now?", correct: 0, options: [
        "Yes, I'll take the envelope as well while I'm here — thanks so much.",
        "Just leave the envelope with you for now; I'll probably collect it some other time next month.",
        "I didn't know the post office delivered on weekends around here." ] },
      { seg: "turn-5", line: "No problem at all. Let me know if anything inside got damaged, okay?", correct: 0, options: [
        "I will — I'll open it tonight and message you if there's any damage.",
        "Nothing ever gets damaged in the mail, so I won't bother checking it.",
        "Could you also recommend a good, affordable moving company for later this year?" ] } ],
    summarize: { prompt: SUM,
      reference: "Jordan visits Priya, a neighbour, to collect a package a delivery driver left with her by mistake. Priya offers to help carry it and says the driver will use Jordan's buzzer next time, which Jordan accepts. Jordan also takes a smaller envelope that arrived the same day and promises to tell Priya if anything inside was damaged.",
      keyPoints: ["who: Jordan and neighbour Priya", "purpose: collect a misdelivered package", "detail: driver will use the buzzer next time (Jordan agrees)", "detail: Jordan also takes an envelope and will report any damage"] } },

  { title: "Surprise birthday plan", level: "EASY",
    scenario: { register: "casual", setting: "A voice note from a friend about a party", speakerName: "Leo", youAre: "Sam" },
    complete: { seg: "scenario", text: [
      "Hey Sam, it's Leo. I'm planning a surprise ", B("party"), " for Mia this Saturday. Can you bring the ", B("cake"),
      " around seven? I'll bring the ", B("balloons"),
      " and some music. Don't tell her anything — she thinks we're just having a quiet ", B("dinner"),
      ". Text me back if you can help!" ] },
    turns: [
      { seg: null, opener: true, line: null, correct: 0, options: [
        "Hi Leo, count me in — I can bring the cake for Mia's surprise on Saturday.",
        "Why on earth are you making such a big fuss out of a single ordinary birthday party?",
        "Have you decided what we're doing for New Year's yet?" ] },
      { seg: "turn-2", line: "Awesome! Do you think you can pick it up from the bakery on Main Street?", correct: 0, options: [
        "Sure, I can easily swing by the bakery on Main Street and pick the cake up on my way over, so you don't have to worry about it.",
        "I don't really like sweet things, so maybe we should skip the cake.",
        "Aren't most of the bakeries around here usually closed on Saturday afternoons, though?" ] },
      { seg: "turn-3", line: "Perfect. Mia's sister is coming too, so we'll be about ten people. Seven still good?", correct: 0, options: [
        "Seven works for me — I'll get there a few minutes early to help set up.",
        "No, let's just cancel the whole thing if her sister is going to be there.",
        "Honestly, I was under the impression this was going to be just the two of us tonight." ] },
      { seg: "turn-4", line: "Great. Can you also keep Mia busy until then? Maybe take her for a coffee?", correct: 0, options: [
        "Sure, I'll take her out for a nice long coffee somewhere and keep her distracted so she stays well away from the flat until seven.",
        "No, I'd honestly rather not talk to Mia at all before the party starts.",
        "The little coffee shop downtown has had painfully slow service for weeks now." ] },
      { seg: "turn-5", line: "You're a lifesaver. I'll send you the address tonight, okay?", correct: 0, options: [
        "Sounds good — send it over and I'll be there with the cake.",
        "Please don't bother sending me the address; I'm sure I can just guess where it is.",
        "I already told Mia all about the surprise, by the way." ] } ],
    summarize: { prompt: SUM,
      reference: "Leo asks Sam to help with a surprise birthday party for Mia on Saturday. Sam agrees to buy the cake from the Main Street bakery and arrive by seven to help set up. Sam will also keep Mia busy with coffee beforehand, and Leo will send the address that night. They keep the plan secret from Mia.",
      keyPoints: ["who: Sam and Leo (planning for Mia)", "purpose: arrange a surprise birthday party Saturday", "tasks: Sam brings the cake and arrives early; Leo brings balloons/music", "detail: Sam keeps Mia busy; Leo sends the address; keep it secret"] } },

  { title: "Library book renewal", level: "EASY",
    scenario: { register: "formal", setting: "At the front desk of a public library", speakerName: "the librarian", youAre: "a library member" },
    complete: { seg: "scenario", text: [
      "Good afternoon. I can see you have two ", B("books"), " due today. You're allowed to ", B("renew"),
      " each title once for another two ", B("weeks"),
      ", as long as no one else has requested it. There's a small ", B("fee"),
      " if a book is returned late. Would you like me to renew them for you now?" ] },
    turns: [
      { seg: null, opener: true, line: null, correct: 0, options: [
        "Yes, please — could you renew both books for another two weeks?",
        "Could you please point me toward wherever you happen to keep the magazines and newspapers?",
        "Just hurry up, I don't have all day to stand here." ] },
      { seg: "turn-2", line: "Certainly. One of them, the history title, has been reserved by another reader, so it can't be renewed.", correct: 0, options: [
        "I understand completely — I'll simply return the history book here today and just keep the other title for the extra two weeks.",
        "That is absolutely ridiculous; no one else should ever be allowed to reserve a book I'm using.",
        "I have never borrowed a history book from here in my life." ] },
      { seg: "turn-3", line: "Thank you. The second book is renewed until the thirtieth. Would you like an email reminder this time?", correct: 0, options: [
        "Yes, an email reminder would be very helpful — thank you.",
        "No thank you; I hardly ever check my email these days, so please don't waste your time.",
        "Do you sell coffee anywhere inside the library?" ] },
      { seg: "turn-4", line: "Done. I've sent it to the address on your account. Is there anything else I can help you with?", correct: 0, options: [
        "Actually, yes, there is — I was hoping you might be able to help me find a good book on the local history of this area.",
        "I would like to make a formal complaint about the parking situation outside the building.",
        "No, and please stop asking me so many questions." ] },
      { seg: "turn-5", line: "Of course. The local history section is on the second floor, to your left. The lift is just behind you.", correct: 0, options: [
        "Thank you — I'll take the lift up to the second floor.",
        "I'm fairly sure that section isn't really located on the second floor at all, actually.",
        "Why is it always so cold in here?" ] } ],
    summarize: { prompt: SUM,
      reference: "A member asks a librarian to renew two books. One, a history title, is reserved by someone else and must be returned, but the second is renewed for two weeks. The member accepts an email reminder and then asks for help finding a book on local history, which the librarian says is on the second floor.",
      keyPoints: ["who: a library member and a librarian", "purpose: renew two borrowed books", "outcome: history book reserved → returned; other renewed two weeks", "detail: email reminder set; directed to the local-history section upstairs"] } },

  { title: "Professor office hours", level: "EASY",
    scenario: { register: "formal", setting: "Speaking to a professor after a lecture", speakerName: "Professor Reed", youAre: "a student" },
    complete: { seg: "scenario", text: [
      "Hello. My ", B("office"), " hours are on Tuesday and Thursday ", B("afternoons"),
      ", from two until four. If those times don't suit you, you can ", B("email"),
      " me to arrange something else. For quick questions, the front of the lecture hall after ", B("class"),
      " is usually fine. What did you want to discuss?" ] },
    turns: [
      { seg: null, opener: true, line: null, correct: 0, options: [
        "Thank you — I'd like to talk about my essay topic for the term paper.",
        "I really need you to grant me a deadline extension right now, and I won't accept any excuses.",
        "Do you know when the cafeteria stops serving lunch?" ] },
      { seg: "turn-2", line: "Of course. Have you chosen a topic yet, or would you like some suggestions?", correct: 0, options: [
        "I do have a rough idea of what I'd like to write about, but I would really appreciate hearing a few of your suggestions as well.",
        "No, and honestly I haven't done a single bit of the assigned reading so far this term.",
        "I already finished the entire paper last week." ] },
      { seg: "turn-3", line: "That's fine. A narrower topic usually works better than a broad one. What area interests you most?", correct: 0, options: [
        "I'm most interested in the industrial history of this region.",
        "To be honest, I don't really find any single part of this subject particularly interesting.",
        "Could you tell me my grade from the last assignment?" ] },
      { seg: "turn-4", line: "Good choice — there's plenty of material on that. Shall I recommend two or three sources to start?", correct: 0, options: [
        "Yes, please — a couple of starting sources would be really useful.",
        "No thank you; I'll just use whatever happens to come up first when I search online.",
        "Is the exam going to be open-book this year?" ] },
      { seg: "turn-5", line: "I'll email you the list this evening. Come to my Tuesday hours if you'd like to discuss it further.", correct: 0, options: [
        "Thank you — I'll come by on Tuesday afternoon with my questions.",
        "I can't ever make Tuesdays, and I don't really want to email you about it either, honestly.",
        "Why do we even have to write a paper at all?" ] } ],
    summarize: { prompt: SUM,
      reference: "A student meets Professor Reed during office hours to discuss their term-paper topic. The student has a rough idea and accepts suggestions; Reed advises narrowing it, and the student chooses the region's industrial history. Reed offers to email a few starting sources that evening and invites the student to Tuesday office hours to discuss further.",
      keyPoints: ["who: a student and Professor Reed", "purpose: discuss a term-paper topic", "advice: narrow the topic → industrial history of the region", "next: Reed emails sources; student to attend Tuesday hours"] } },

  // ============================ MEDIUM ============================
  { title: "Splitting the grocery bill", level: "MEDIUM",
    scenario: { register: "casual", setting: "A roommate raises shared costs at home", speakerName: "Dana", youAre: "her roommate" },
    complete: { seg: "scenario", text: [
      "Hey, so I went through last month's ", B("receipts"), ". We spent about two hundred dollars on ", B("groceries"),
      " together, but I paid for most of it on my ", B("card"),
      ". I think you owe me around ninety. I also covered the cleaning ", B("supplies"),
      ", which we said we'd split evenly. Can we sort it out this weekend?" ] },
    turns: [
      { seg: null, opener: true, line: null, correct: 0, options: [
        "Yeah, let's sort it out — ninety sounds about right, I'll pay you back.",
        "I'm honestly not paying you a cent; you always buy way too much overpriced stuff anyway.",
        "Did you watch that new show everyone's talking about?" ] },
      { seg: "turn-2", line: "Thanks. Do you want to just transfer it, or should we take it off next month's shopping?", correct: 0, options: [
        "Let's just take it off next month's shopping instead — I'll cover more of the groceries then so the two of us come out roughly even.",
        "Honestly, neither — I'd rather we just stopped sharing any of the groceries completely from now.",
        "I already paid you back in full last week." ] },
      { seg: "turn-3", line: "That works. One thing though — the cleaning supplies were forty, so that's twenty each on top. Fair?", correct: 0, options: [
        "Fair enough — I'll add my twenty for the cleaning supplies too.",
        "No way — you honestly use far more of the cleaning supplies around here than I ever do.",
        "Let's just forget about money altogether from now on." ] },
      { seg: "turn-4", line: "Great. Should we set a monthly budget so this is easier to track next time?", correct: 0, options: [
        "That's a really good idea — setting a shared monthly budget would make the whole thing far simpler to keep track of next time.",
        "No, I think budgets are completely pointless, and I know I'd never actually stick to one anyway.",
        "What time is the game on tonight?" ] },
      { seg: "turn-5", line: "Perfect. I'll make a shared note where we both add what we spend. Sound good?", correct: 0, options: [
        "Sounds good — I'll add my receipts to the shared note each week.",
        "Please don't bother setting that up; I know I'll never actually remember to write anything down.",
        "Can I borrow your charger? Mine's broken." ] } ],
    summarize: { prompt: SUM,
      reference: "Dana tells her roommate they owe about ninety dollars for last month's shared groceries, plus twenty for cleaning supplies, since Dana paid on her card. They agree to settle it by having the roommate buy more of next month's shopping and split the supplies. They also decide to set a shared monthly budget and a note to track spending.",
      keyPoints: ["who: two roommates (Dana and you)", "purpose: settle shared grocery and cleaning costs", "amounts: ~90 for groceries + 20 for cleaning supplies", "plan: offset via next month's shopping; shared budget and spending note"] } },

  { title: "Rescheduling a dentist appointment", level: "MEDIUM",
    scenario: { register: "formal", setting: "A phone call from a dental clinic", speakerName: "the receptionist", youAre: "a patient" },
    complete: { seg: "scenario", text: [
      "Good morning, this is the Bright Smile dental clinic. I'm calling to confirm your ", B("appointment"),
      " for a ", B("check-up"), " this Friday at ten. If that time no longer works, we can move you to the following ", B("week"),
      ". Please remember to bring your ", B("insurance"),
      " card. Could you let me know if Friday still suits you?" ] },
    turns: [
      { seg: null, opener: true, line: null, correct: 0, options: [
        "Thank you for calling — actually, Friday no longer works; could we reschedule?",
        "You people at that clinic always seem to call at the single most inconvenient time possible.",
        "Do you also treat pets at this clinic, by any chance?" ] },
      { seg: "turn-2", line: "Not a problem. We have openings next Tuesday at nine or next Thursday at two. Which do you prefer?", correct: 0, options: [
        "Thursday at two o'clock would suit me a great deal better than the Tuesday morning would, so let's go ahead with that one, thank you.",
        "Honestly, just go ahead and pick whichever one of those you personally happen to feel like.",
        "Neither; I don't think I need a check-up at all now." ] },
      { seg: "turn-3", line: "Thursday at two it is. The appointment usually takes about thirty minutes. Will that be enough time?", correct: 0, options: [
        "Yes, thirty minutes should be plenty — I'll plan around it.",
        "No, not really; I'm always in a terrible rush and honestly can't afford to wait that long.",
        "How much does a whole set of new teeth cost?" ] },
      { seg: "turn-4", line: "Understood. And will you be using the same insurance as last time, or has anything changed?", correct: 0, options: [
        "It's the same insurance as last time — nothing has changed.",
        "Would it be at all possible for me to pay you in small instalments over the next year?",
        "I don't have any insurance and never have, actually." ] },
      { seg: "turn-5", line: "Perfect. I'll send a text reminder the day before. Please arrive ten minutes early to update your details.", correct: 0, options: [
        "Thank you — I'll arrive ten minutes early on Thursday with my card.",
        "Why exactly do you need all of my personal details again? I'm quite sure you already have them.",
        "I'm never early for anything, so don't expect that." ] } ],
    summarize: { prompt: SUM,
      reference: "A dental clinic receptionist calls to confirm a Friday check-up. The patient needs to reschedule, and they agree on next Thursday at two, which takes about thirty minutes. The patient will use the same insurance as before. The receptionist will send a text reminder and asks the patient to arrive ten minutes early to update their details.",
      keyPoints: ["who: a patient and a dental receptionist", "purpose: reschedule a check-up appointment", "new time: Thursday at two (~30 minutes)", "details: same insurance; text reminder; arrive 10 minutes early"] } },

  { title: "Helping a friend move", level: "MEDIUM",
    scenario: { register: "casual", setting: "A friend asks for help with a move", speakerName: "Chris", youAre: "his friend" },
    complete: { seg: "scenario", text: [
      "Hey, I'm finally ", B("moving"), " to the new place on Saturday. I've rented a small ", B("van"),
      ", but I could really use an extra pair of hands with the ", B("furniture"),
      ". If you can come around nine, we should be done by lunch. I'll buy ", B("pizza"),
      " afterwards. Are you free?" ] },
    turns: [
      { seg: null, opener: true, line: null, correct: 0, options: [
        "Yeah, I'm free Saturday — I'll come at nine to help with the furniture.",
        "Honestly, moving is such an enormous hassle that I really don't want to have to deal with it.",
        "Have you paid me back the money from last month yet?" ] },
      { seg: "turn-2", line: "You're the best. The heaviest thing is the sofa — think the two of us can manage it?", correct: 0, options: [
        "I think the two of us can manage the sofa without too much trouble if we take the legs off first and then carry it slowly.",
        "I actually threw my back out pretty badly last year while I was lifting weights at the gym.",
        "No, let's just leave the sofa behind at the old place." ] },
      { seg: "turn-3", line: "Good thinking. The new place is on the third floor, but there's a lift. Should we book it in advance?", correct: 0, options: [
        "Yes, let's book the lift early so no one else is using it.",
        "No, I think the stairs will be perfectly fine, even for all of the really heavy boxes.",
        "Which floor did you say you were leaving?" ] },
      { seg: "turn-4", line: "Smart. I'll reserve it for the morning. Could you bring some rope and an old blanket too?", correct: 0, options: [
        "Sure, I'll dig out some rope and a couple of old blankets so we can wrap the furniture properly and stop it getting scratched.",
        "No, honestly, I'm not going to bring any of my own stuff along for this whole thing.",
        "Do you still have my drill from two years ago?" ] },
      { seg: "turn-5", line: "Perfect. Let's aim to finish by one so we can eat. I'll get the pizza from that place you like.", correct: 0, options: [
        "Sounds great — let's finish by one and get the pizza you mentioned.",
        "By the way, is that whole new neighbourhood of yours actually safe to walk around at night?",
        "Don't get pizza; I'm not eating anything that day." ] } ],
    summarize: { prompt: SUM,
      reference: "Chris asks a friend to help him move to a new apartment on Saturday, arriving at nine to carry furniture, including a heavy sofa they'll take apart. The new place is on the third floor with a lift, which Chris will reserve for the morning. The friend will bring rope and blankets, and they plan to finish by one and eat pizza afterward.",
      keyPoints: ["who: Chris and a friend", "purpose: arrange help for Saturday's apartment move", "plan: arrive 9, manage the sofa, book the lift for morning", "extras: friend brings rope/blankets; finish by one; pizza after"] } },

  // ============================ HARD ============================
  { title: "Weekend-trip budget", level: "HARD",
    scenario: { register: "casual", setting: "Friends planning a weekend away", speakerName: "Nadia", youAre: "her friend" },
    complete: { seg: "scenario", text: [
      "Okay, so I've been crunching the numbers for our weekend away. If we split a ", B("cabin"),
      " four ways, it's cheaper than two hotel rooms, but we'd have to share the ", B("cooking"),
      ". ", B("Petrol", ["petrol"]), " and food will run us about eighty each. I'd rather spend less on accommodation and more on ", B("activities"),
      ". What do you reckon?" ] },
    turns: [
      { seg: null, opener: true, line: null, correct: 0, options: [
        "I'm with you — let's take the cabin and put the savings toward activities.",
        "There's no way I'm sharing a cramped kitchen with a bunch of people I can barely even tolerate.",
        "Did you ever return that jacket you borrowed from me?" ] },
      { seg: "turn-2", line: "Great. The catch is the cabin's a half-hour further out. Are you okay with the extra driving?", correct: 0, options: [
        "The extra half-hour of driving is honestly fine by me, especially if it means we end up with a much nicer place to stay for the weekend.",
        "No, absolutely not — I'm not willing to drive even a single extra minute more than necessary.",
        "Cabins always smell of damp, in my experience." ] },
      { seg: "turn-3", line: "Fair. For food, should we meal-prep beforehand or just buy stuff once we get there?", correct: 0, options: [
        "Let's prep a couple of meals ahead and buy the rest locally.",
        "Let's honestly just eat out every single night; the whole idea of cooking on holiday is depressing.",
        "I'm on a strict diet and can't eat any of that." ] },
      { seg: "turn-4", line: "I like that balance. Now, activities — the hiking's free, but the kayaking tour is forty a head. Worth it?", correct: 0, options: [
        "The kayaking's worth forty to me — we can skip something else to cover it.",
        "No, honestly, forty a head is absolute daylight robbery for just a couple of hours on the water.",
        "I get seasick just looking at the water." ] },
      { seg: "turn-5", line: "Deal. So: cabin, one big food shop, hiking and kayaking. Shall I book the cabin tonight before it's gone?", correct: 0, options: [
        "Yes, book it tonight — lock it in before someone else grabs it.",
        "Actually, now that I think about it, I don't think I can even come along this weekend after all.",
        "Wait, let's keep looking; there might be something cheaper." ] } ],
    summarize: { prompt: SUM,
      reference: "Nadia and a friend plan a weekend trip on a budget. They agree to split a cabin four ways instead of hotel rooms, accepting a longer drive and shared cooking, at about eighty each for petrol and food. They will meal-prep some food and buy the rest locally, do the free hiking plus a forty-per-person kayaking tour, and Nadia will book the cabin that night.",
      keyPoints: ["who: Nadia and a friend (group of four)", "purpose: plan a budget weekend trip", "choices: cabin over hotels (longer drive, shared cooking), ~80 each", "activities: some meal-prep, free hiking + paid kayaking; book cabin tonight"] } },

  { title: "First-day onboarding", level: "HARD",
    scenario: { register: "formal", setting: "A new employee's first morning with HR", speakerName: "Ms. Okafor", youAre: "a new employee" },
    complete: { seg: "scenario", text: [
      "Welcome aboard. Before you start, we need to set up your ", B("accounts"),
      " and hand over your equipment. IT will issue a ", B("laptop"), " and a security ", B("badge"),
      " this morning. You'll also need to complete two ", B("compliance"),
      " modules by the end of the week. Your manager will meet you after lunch. Any questions before we begin?" ] },
    turns: [
      { seg: null, opener: true, line: null, correct: 0, options: [
        "Thank you — could you tell me where I collect the laptop and badge?",
        "I heard a rumour — is it actually true that the whole company might be sold off sometime next year?",
        "Just give me everything now; I don't need any explanation." ] },
      { seg: "turn-2", line: "Certainly. IT is on the third floor; they're expecting you at half past nine. Shall I walk you up?", correct: 0, options: [
        "That's very kind of you, thank you — since it's my very first day here, I'd genuinely appreciate you showing me the way up there.",
        "No thank you, I'll just find it entirely on my own; I really don't need any hand-holding here.",
        "Why is everything in this building on a different floor?" ] },
      { seg: "turn-3", line: "Of course. The compliance modules cover data protection and workplace safety. Will you have time this week?", correct: 0, options: [
        "Yes, I'll set aside an hour or two to finish them this week.",
        "No, honestly, I'm going to be far too busy to bother with any sort of online training this week.",
        "Do we get paid extra for doing that training?" ] },
      { seg: "turn-4", line: "Good. One more thing — your badge also works for the car park and the canteen. Keep it on you at all times.", correct: 0, options: [
        "Understood — I'll make sure to keep the badge on me at all times, since it sounds like I'll need it for the car park and the canteen too.",
        "The food in that canteen had honestly better be completely free for all of the staff here.",
        "I'll probably just leave it in my desk drawer most days." ] },
      { seg: "turn-5", line: "Perfect. Your manager, Mr. Hale, will go over your first projects after lunch. Anything else before IT?", correct: 0, options: [
        "No, that's everything — thank you for getting me settled in.",
        "Yes, actually — I still genuinely think this entire onboarding process is a complete waste of my time.",
        "Can I take the rest of the day off instead?" ] } ],
    summarize: { prompt: SUM,
      reference: "On a new employee's first day, HR's Ms. Okafor explains onboarding: IT will issue a laptop and security badge on the third floor at nine-thirty, and the employee must finish two compliance modules on data protection and safety by the week's end. The badge also works for the car park and canteen. The manager, Mr. Hale, will discuss first projects after lunch.",
      keyPoints: ["who: a new employee and HR (Ms. Okafor)", "purpose: first-day onboarding steps", "IT: laptop + security badge, third floor, 9:30", "tasks: two compliance modules by week's end; manager meeting after lunch"] } },

  { title: "Apartment viewing", level: "HARD",
    scenario: { register: "formal", setting: "Viewing a flat with a letting agent", speakerName: "Mr. Bello", youAre: "a prospective tenant" },
    complete: { seg: "scenario", text: [
      "Thanks for coming. This is a one-bedroom flat with a south-facing ", B("balcony"), ". The ", B("rent"),
      " is fourteen hundred a month, and that includes water but not electricity. The landlord asks for a two-month ", B("deposit"),
      " and ", B("references"),
      " from a previous tenancy. The earliest move-in date is the first. Shall I show you the kitchen first?" ] },
    turns: [
      { seg: null, opener: true, line: null, correct: 0, options: [
        "Yes, please — and could you clarify what bills are included in the rent?",
        "Just out of curiosity, has anybody ever actually been burgled anywhere in this building before?",
        "I'll take it right now without seeing any of the rooms." ] },
      { seg: "turn-2", line: "Certainly. Rent covers water and building maintenance; you'd pay electricity, gas, and internet separately. Within budget?", correct: 0, options: [
        "It's a little higher than I'd hoped, but it should still be manageable for me as long as the electricity bills aren't too excessive.",
        "No, I honestly expected every single bill to be completely included in the rent for that kind of price.",
        "Are the neighbours the loud sort or the quiet sort?" ] },
      { seg: "turn-3", line: "The average electricity bill here is around sixty a month. On the deposit — would two months be workable?", correct: 0, options: [
        "Two months is a stretch, but I could manage it by the first.",
        "No, I never pay any deposit whatsoever; that sort of thing is entirely the landlord's own problem.",
        "Why is the ceiling stained in the corner over there?" ] },
      { seg: "turn-4", line: "Understood. I can ask the landlord about splitting the deposit across two payments. Would that help?", correct: 0, options: [
        "Yes, splitting the deposit into two payments would really help me.",
        "Out of interest, does the monthly rent tend to go up quite noticeably every single year in this place?",
        "No, don't ask him anything at all on my behalf." ] },
      { seg: "turn-5", line: "I'll put that to him. If you're happy after seeing the rest, you can hold the flat with a small fee today.", correct: 0, options: [
        "Let me see the rest first, then I'll decide about the holding fee.",
        "One last thing — would it be all right if I moved all six of my cats in as early as this weekend?",
        "I'll pay the holding fee now before I've even looked around." ] } ],
    summarize: { prompt: SUM,
      reference: "A letting agent, Mr. Bello, shows a one-bedroom flat with a balcony at fourteen hundred a month, which includes water but not electricity, gas, or internet. The landlord wants a two-month deposit and references. The prospective tenant finds it manageable, asks about splitting the deposit into two payments, and decides to see the rest of the flat before paying a holding fee.",
      keyPoints: ["who: a prospective tenant and agent Mr. Bello", "property: 1-bed flat with balcony, 1400/month (water included)", "terms: 2-month deposit + references; electricity/gas/internet extra", "asks: split deposit into two payments; view rest before holding fee"] } },

  { title: "Course-registration clash", level: "HARD",
    scenario: { register: "formal", setting: "Meeting an academic advisor about a timetable problem", speakerName: "Dr. Lin", youAre: "a student" },
    complete: { seg: "scenario", text: [
      "Come in. I see there's a ", B("clash"), " in your schedule — your ", B("statistics"),
      " lecture overlaps with the required ", B("seminar"),
      " on Thursdays. You have two options: switch to the evening statistics section, or defer the seminar to next semester. Bear in mind the seminar is a ", B("prerequisite"),
      " for your final-year project. Which would you prefer to discuss?" ] },
    turns: [
      { seg: null, opener: true, line: null, correct: 0, options: [
        "I'd rather keep the seminar — could we look at moving statistics to the evening?",
        "By the way, is it actually true that you're planning to retire from the university at the end of this year?",
        "Just cancel one of them for me; I don't care which." ] },
      { seg: "turn-2", line: "Sensible, given the prerequisite. The evening section runs six to eight on Mondays. Would that fit your commitments?", correct: 0, options: [
        "Monday evenings would work perfectly well for me, as I don't have anything else at all scheduled during that particular time slot.",
        "No, I make it a firm rule never to study anything at all after five o'clock, under any circumstances.",
        "Will the evening class have the same lecturer as the day one?" ] },
      { seg: "turn-3", line: "Same lecturer, same syllabus. I'll also need to confirm the seminar tutor keeps your place. Shall I email her today?", correct: 0, options: [
        "Yes, please email the tutor today to hold my seminar place.",
        "No, don't worry about it — I'll probably just sort the whole thing out with her myself eventually.",
        "Do I really need this seminar for the project?" ] },
      { seg: "turn-4", line: "It's essential — the project builds directly on it. Once I switch you, you'll get a new timetable by email. Clear?", correct: 0, options: [
        "Yes, that's all perfectly clear — I'll keep an eye on my inbox and watch for the updated timetable coming through by email.",
        "Honestly, could you just go ahead and choose every single one of my modules for the next three years?",
        "Not really, but I'd rather not take up any more of your time." ] },
      { seg: "turn-5", line: "Happy to help. Check the new timetable carefully for any further clashes, and email me if anything looks wrong.", correct: 0, options: [
        "I will — I'll go through the new timetable and flag any problems.",
        "I'm sure it'll all be completely fine; I really won't bother checking any of it at all, honestly.",
        "Why does this university make everything so complicated?" ] } ],
    summarize: { prompt: SUM,
      reference: "An academic advisor, Dr. Lin, tells a student their statistics lecture clashes with a required Thursday seminar, which is a prerequisite for the final-year project. They agree to keep the seminar and move statistics to the evening section (Mondays six to eight), same lecturer and syllabus. Dr. Lin will email the seminar tutor to hold the place and send an updated timetable for the student to check.",
      keyPoints: ["who: a student and advisor Dr. Lin", "problem: statistics lecture clashes with a required seminar (a prerequisite)", "solution: keep seminar; switch statistics to the Monday evening section", "follow-up: advisor emails tutor + sends new timetable to review"] } },
];

// Compatibility: expose both named and default so any loader import style resolves.
export default SCENARIOS;
