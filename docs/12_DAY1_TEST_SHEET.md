# 12 · Day-1 Test Sheet: Measure the Meta Models Before Building on Them

*Updated Oct 22 for the metre bridge hero (doc 15). Run on **Mon Oct 26, right after kickoff (17:00 WAT)**, using the dataset from `11_GOLDEN_PAGES_GUIDE.md`. Budget: about 3 hours. The results decide the pipeline shape (`06_META_AI_INTEGRATION.md`). Save every raw response as a fixture so the rest of the build can run offline.*

> **Before kickoff (allowed today):** step 0 only: confirm access and credits with one manual call. Everything below runs from Oct 26.

---

## 0. Access check (do it now, Oct 22)
| Check | Result |
|---|---|
| Logged in to dev.meta.ai from Nigeria (no "unavailable in your region" page) | ☐ yes ☐ no |
| API key created | ☐ yes ☐ no |
| One manual test call to `muse-spark-1.3` succeeded | ☐ yes ☐ no |
| Credits visible (amount: ______) | ☐ yes ☐ no |
| **If any "no":** post in the official Discord / contact Cerebral Valley immediately; do not wait until Oct 26 | |

## 1. SAM 3.1 on sketches

**Plan A: text prompts.** For 10 metre bridge pages (with their graph sheets) and 5 titration pages, send one request per phrase, with confidence turned on.

| Label | Phrasings to try |
|---|---|
| **graph** (scored: GRAPH-SCALE uses its mask area) | "graph" · "line graph on graph paper" · "plotted graph" |
| galvanometer | "galvanometer" · "circle with G" · "meter" |
| resistance box | "resistance box" · "box labelled R" · "rectangle" |
| metre bridge wire | "long straight wire" · "metre bridge" · "ruler" |
| cell | "cell" · "battery symbol" |
| key | "key" · "switch" |
| results table | "table" · "results table" |
| burette | "burette" · "drawing of a burette" · "long thin tube" |
| conical flask | "conical flask" · "drawing of a flask" · "triangle-shaped flask" |
| retort stand | "retort stand" · "stand" |
| white tile | "white tile" · "rectangle" |
| paper | "sheet of paper" · "page" |

| Measure | How | Record |
|---|---|---|
| Hit rate | Correct object boxed / pages where it exists | ___ % per label |
| **Graph mask area** | Mask area ÷ page area vs a ruler measurement, on G1 (≈ ¼) and G2 (≥ ½) | error ___ % (need ≤ 10% to score GRAPH-SCALE from SAM) |
| False hits | Boxes on the wrong thing | ___ |
| Latency | Per request, p50 / p95 | ___ / ___ s |

**Plan B: box prompts.** Take Spark's approximate boxes (test 2) for 5 pages and send them as box prompts.
| Measure | Record |
|---|---|
| Mask hugs the ink inside the box? | ☐ good ☐ rough ☐ useless |

**Decision:**
- Text-prompt hit rate ≥ 60% on golden pages → **Plan A**.
- Otherwise, if box prompts give good masks → **Plan B**.
- Otherwise → **Plan C** (outlines from the blueprint; SAM used for the paper mask only, said honestly in the drawer).
- **Graph area:** if the SAM mask is within 10% → SAM scores GRAPH-SCALE. Otherwise use Spark's approximate graph box and say so in the drawer.

## 2. Muse Spark 1.3: blueprint compile (low effort, strict schema, streamed)

Run on all 30+ photos, including the "wrong" pages.

| Measure | Target | Record |
|---|---|---|
| Correct experiment (meter_bridge / titration / glass_block / unknown) | ≥ 90% | ___ % |
| "Unknown" for non-practical pages | ≥ 80% | ___ % |
| Values read correctly on golden pages (R values; molarity, volume, indicator, equation) | 100% on G1–G3 | ___ |
| Setup issue "no key in the circuit" reported on G1, and not on G2 | Yes | ☐ |
| Balanced equation returned as written | ≥ 90% | ___ |
| Time to first field (experiment) | ≤ 2 s | ___ s |
| Time to complete | ≤ 6 s | ___ s |
| Schema-valid every time | 100% | ___ |

**Decision:** if experiment accuracy < 90%, add the experiment-hint tap as the default first step; if latency is too high, shrink the schema or try `minimal` effort.

## 3. Muse Wonder 1.0: handwriting extraction (medium effort, strict schema)

Run on G1, G2 and the messy pages, 3 times each (consistency check).

| Measure | Target | Record |
|---|---|---|
| `text_as_written` exactly right on G1 (especially **"57"** stays "57", not "57.0", and **"0.02"** stays "0.02") and on G3 (**"24.5"** stays "24.5") | 100% | ___ |
| **Graph:** axis labels and units as written (G1 vertical axis has none), five points within half a small square, triangle corners, s, c, X | Labels 100%; points ≥ 90% | ___ |
| **Precautions** copied word for word (the tense check depends on it) | 100% on G1, G2 | ☐ |
| Cells exactly right on messy pages | ≥ 85% | ___ % |
| Same answer across 3 runs | 100% on G1/G2 | ☐ |
| Boxes land on the right cells (overlay check by eye) | Yes | ☐ |
| Unclear cells flagged "unsure" rather than guessed | Yes | ☐ |
| Latency | ≤ 20 s (it runs in the background) | ___ s |

**Decision:** if "57" is ever "corrected" to "57.0" (or "24.5" to "24.50"), change the prompt and schema description until it isn't. This is the hero moment. If graph points are unreliable, keep the "confirm your graph" step as the default on fresh uploads. If Wonder is too slow or inconsistent, test Spark 1.3 at `medium` for the same job and compare.

## 4. Muse Voice Transcribe (realtime, push-to-talk, English bias, WAEC keywords)

Play the 10–20 audio clips through a quick manual test.

| Measure | Target | Record |
|---|---|---|
| WAEC keywords transcribed correctly (jockey, galvanometer, constantan, balance point, methyl orange, concordant, meniscus…) | ≥ 85% | ___ % |
| Nigerian English clips: meaning preserved | ≥ 90% | ___ % |
| Pidgin clips: meaning preserved | measure honestly | ___ % |
| Final transcript after speech ends | ≤ 1.5 s | ___ s |

**Then:** send 3 Pidgin clips as audio to **`muse-spark-1.2`** and ask what the student meant. Does it understand better than the transcript?
**Decision:** if Pidgin meaning < 70% via transcript but good via Spark 1.2 audio → add the Spark 1.2 audio path (a COULD item becomes a SHOULD).

## 5. Muse Image (one quick try)
Edit G1 into "this apparatus on a real school laboratory bench, photograph" (metre bridge, plug box, galvanometer, cell).
| Measure | Record |
|---|---|
| Apparatus roughly right (metre bridge, resistance box, galvanometer, cell, key)? | ☐ yes ☐ no |
| Latency | ___ s |
**Decision:** keep the "reality preview" card only if it looks right in 2 of 3 tries.

## 6. Latency from Abuja vs server region
Time the same Spark call from your laptop and from a test server in 2–3 regions (e.g. US-East, Europe).
| From | p50 | p95 |
|---|---|---|
| Laptop in Abuja | | |
| US-East | | |
| Europe | | |
**Decision:** put the API service in the region with the fastest Meta round trip.

## 7. Cost check
Note credits before and after the whole test. Expected: a few dollars.
| Before | After | Spent |
|---|---|---|
| | | |

## 8. Summary to write at the end of Day 1 (one paragraph)
- SAM plan: A / B / C
- Spark compile accuracy and latency
- Wonder handwriting accuracy (whether "57" and "24.5" survive) and graph reading
- Voice: English ok? Pidgin path?
- Reality preview: keep or drop
- Server region
- Anything that changes the plan
