/**
 * RR-401 · the factory's model answers, as the importer wrote them (src/content/factory/det-model-answers.json). Server-only reader for
 * the result view. Content is shown exactly as written; never edited here.
 *
 * Only a READY item is ever returned: an image-pending or audio-pending item is hidden (it is not in the bank either), so a learner
 * never meets a task, or its model answers, without the image or audio it needs.
 */
import data from "@/content/factory/det-model-answers.json";
import type { ModelData, ModelItem } from "./import";

export const MODEL_DATA = data as unknown as ModelData;

export function modelAnswersFor(taskType: string, title: string): ModelItem | null {
  return MODEL_DATA.items.find((i) => i.status === "ready" && i.taskType === taskType && i.title === title) ?? null;
}
