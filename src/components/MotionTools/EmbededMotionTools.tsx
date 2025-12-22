import useSvelte from "../../lib/hooks/useSvelte";
import EmbedMotionTools from "./EmbededMotionTools.svelte";

const SvelteEmbededMotionTools = useSvelte(EmbedMotionTools);

export default function EmbededMotionTools({ name }: { name: string }) {
  return <SvelteEmbededMotionTools name={name} />;
}