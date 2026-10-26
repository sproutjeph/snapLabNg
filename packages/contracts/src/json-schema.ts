import { z } from "zod";
import { BlueprintSchema } from "./blueprint";
import { ReadingsSchema } from "./readings";

export const blueprintJsonSchema = z.toJSONSchema(BlueprintSchema);
export const readingsJsonSchema = z.toJSONSchema(ReadingsSchema);
