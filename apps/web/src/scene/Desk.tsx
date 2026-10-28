import type { QualityTier } from "../apparatus/meter-bridge/types";
import { PaperDesk } from "./ink/PaperDesk";

/** The desk under the exercise book: warm paper, like every bench in the ink look. */
export function Desk({ quality }: { quality: QualityTier }) {
  return <PaperDesk quality={quality} size={[8, 5]} y={0} />;
}
