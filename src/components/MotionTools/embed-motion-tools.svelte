<script lang="ts">
  import { MotionTools } from "@viamrobotics/motion-tools";
  import { ViamProvider } from "@viamrobotics/svelte-sdk";
  import { QueryClient } from "@tanstack/svelte-query";

  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
      },
    },
  });
</script>

<ViamProvider dialConfigs={[]} {client}>
  <MotionTools />
</ViamProvider>
