<script lang="ts">
  import { MotionTools } from "@viamrobotics/motion-tools";
  import { ViamProvider } from "@viamrobotics/svelte-sdk";
  import { QueryClient } from "@tanstack/svelte-query";

  // just some dumby props to test the component
  interface EmbededMotionToolsProps {
    name: string;
  }
  const { name }: EmbededMotionToolsProps = $props<EmbededMotionToolsProps>();

  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
      },
    },
  });
</script>

<ViamProvider dialConfigs={[]} {client}>
  <span>{name}</span>
  <MotionTools />
</ViamProvider>
