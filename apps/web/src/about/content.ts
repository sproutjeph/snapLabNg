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
      "A student snaps the metre bridge practical in their exercise book. The apparatus they drew rises out of the ink as a working 3D lab they can use. Their own handwriting is then marked in red ink, item by item, and an examiner-style voice asks them about their own mistakes.",
    ],
  },
  {
    id: "how",
    heading: "How it works",
    paragraphs: [
      "Everything that decides a number is ordinary, tested code. The AI reads and explains.",
    ],
    bullets: [
      "Muse Spark reads the drawing: which experiment it is, and where each part is.",
      "Muse Wonder reads the table and the graph exactly as written, including mistakes like 57 instead of 57.0.",
      "SAM 3.1 outlines the parts she drew, so they can lift off the page.",
      "A physics engine runs the circuit: the balance point, the galvanometer needle and the cell.",
      "A fixed rule engine gives the marks, so the same page always gets the same score.",
      "Muse Spark judges her spoken or typed answers to the examiner's questions. It never changes a mark.",
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
