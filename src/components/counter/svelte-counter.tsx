import useSvelte from "../../lib/hooks/useSvelte";
import Counter from "./counter.svelte";

export default function SveleteCounter({initialCount = 0}: {initialCount: number}) {
    const SvelteCounter = useSvelte(Counter);

    return <SvelteCounter initCount={initialCount} />;
}