export interface AboutSection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export const ABOUT_SECTIONS: AboutSection[] = [
  {
    id: "what",
    heading: "What it does",
    paragraphs: [
      "SnapLab NG turns a real WAEC practical into a bench you can work at. Its first practical is Ohm's law (V–I), from WASSCE 2018 Physics Paper 3, Question 3B. In Watch, the question is read aloud and the practical is done on a 3D bench step by step as each sentence is read: the parts, the wiring, the readings, the table, the graph and the slope. In Practise, you wire and measure it yourself with a guide. In Exam, you sit it with a clock and no hints, then hand in for marks. The metre bridge and titration practicals are marked Coming soon.",
    ],
  },
  {
    id: "how",
    heading: "How it works",
    paragraphs: [
      "Everything that decides a number is ordinary, tested code. The AI reads and explains.",
    ],
    bullets: [
      "A physics engine (packages/engine) runs the circuit and the meters.",
      "A fixed rule engine (packages/rules) gives the marks from the WAEC marking scheme, so the same work always gets the same score.",
      "The snap-your-notebook mode works today for the metre bridge (/?flow=1): Muse Spark reads the drawing: which experiment it is, and where each part is.",
      "In that mode, Muse Wonder reads the table and the graph exactly as written, including mistakes like 57 instead of 57.0.",
      "SAM 3.1 outlines the parts she drew, so they can lift off the page.",
      "An examiner-style voice then asks about her own mistakes. Muse Spark judges her spoken or typed answers to the examiner's questions. It never changes a mark.",
    ],
  },
  {
    id: "honest",
    heading: "What the AI does not do",
    paragraphs: [],
    bullets: [
      "It never decides marks. The rules do.",
      "It never shows the expected answer. Accuracy is only marked against a value a teacher measured.",
      "It is not a human and not an official WAEC examiner.",
    ],
  },
  {
    id: "privacy",
    heading: "Privacy",
    paragraphs: [
      "Your name and school at the top of the page are blurred on your phone before upload. Your photo is not saved. Spending on the AI has a hard daily limit.",
    ],
  },
  {
    id: "built",
    heading: "When it was built",
    paragraphs: [
      "Built solo for the Meta Global AI Developer Hackathon, October 26 to November 4, 2026, with Claude Code, Gemini and Muse Code, Meta's coding agent. Planning and design were done before the event; a small amount of setup code was written a few hours before kickoff on October 26, and is disclosed in the project's README.",
    ],
  },
  {
    id: "credits",
    heading: "Credits",
    paragraphs: [
      "Meta Model API (Muse Spark, Muse Wonder, SAM 3.1). three.js and React Three Fiber. WAEC practical requirements are taken from WAEC's public e-Learning pages. Not affiliated with WAEC.",
    ],
  },
];
