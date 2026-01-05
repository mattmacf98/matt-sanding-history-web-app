import { SnapshotProto } from '@viamrobotics/motion-tools/lib'
import useSvelte from '../../lib/hooks/useSvelte'
import SvelteSnapshot from './SvelteSnapshot.svelte'

const SvelteSnapshotComponent = useSvelte(SvelteSnapshot)

export default function SnapshotComponent({
  snapshot,
}: {
  snapshot: SnapshotProto
}) {
  return <SvelteSnapshotComponent snapshot={snapshot} />
}
