import { examinerQuestions } from "@snaplab/rules";
import { describe, expect, it } from "vitest";
import { g1Sheet } from "../marking/g1Readings";
import { makeAsk } from "./examinerClient";

const list = examinerQuestions(g1Sheet);

describe("makeAsk", () => {
  it("sends her own mistake with the answer and takes the next question from the list", async () => {
    let sent: unknown = null;
    const fake = (async (_url: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ verdict: "partly", reply: "Good start.", model_answer: "Bank answer." }),
      );
    }) as typeof fetch;
    const first = list[0]?.question;
    if (!first) throw new Error("G1 has questions");
    const r = await makeAsk(list, fake)(
      { question: first, answer: "E go scratch am", language: "pidgin" },
      new AbortController().signal,
    );
    expect(sent).toEqual({
      question_id: "mb-jockey-slide",
      answer: "E go scratch am",
      language: "pidgin",
      her_mistake: list[0]?.her_mistake,
    });
    expect(r).toEqual({
      verdict: "partly",
      reply: "Good start.",
      modelAnswer: "Bank answer.",
      next: list[1]?.question,
    });
  });

  it("rejects when the server refuses, so the console shows its retry message", async () => {
    const fake = (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
    const first = list[0]?.question;
    if (!first) throw new Error("G1 has questions");
    await expect(
      makeAsk(list, fake)(
        { question: first, answer: "x", language: "english" },
        new AbortController().signal,
      ),
    ).rejects.toThrow("503");
  });
});
