<script lang="ts">
    import { MotionTools } from "@viamrobotics/motion-tools";
    import { Snapshot, SnapshotProto } from "@viamrobotics/motion-tools/lib";
    import { ViamProvider } from "@viamrobotics/svelte-sdk";
    import { QueryClient } from "@tanstack/svelte-query";

    interface SvelteSnapshotProps {
        snapshot: SnapshotProto;
    }
    const { snapshot }: SvelteSnapshotProps = $props<SvelteSnapshotProps>();
  
  
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
        },
      },
    });

  </script>
  
  <ViamProvider dialConfigs={{}} {client}>
    <MotionTools>
        <Snapshot snapshot={snapshot} />
    </MotionTools>
  </ViamProvider>
  