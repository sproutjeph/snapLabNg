import { z } from "zod";
import { BlueprintSchema } from "./blueprint";
import { ExaminerJudgement } from "./examiner";
import { QuestionRead } from "./question";
import { ReadingsSchema } from "./readings";

export const blueprintJsonSchema = z.toJSONSchema(BlueprintSchema);
export const readingsJsonSchema = z.toJSONSchema(ReadingsSchema);
export const examinerJudgementJsonSchema = z.toJSONSchema(ExaminerJudgement);
export const questionJsonSchema = z.toJSONSchema(QuestionRead);
