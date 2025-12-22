import { useLayoutEffect, useRef } from 'react';
import { mount, unmount } from 'svelte';

type Component = Parameters<typeof mount>[0];
type Props = Parameters<typeof mount>[1]["props"];

/** A wrapper for Svelte component */
export default function useSvelte(Component: Component) {
    function SvelteWrapper(props: Props) {
        const svelteRef = useRef<HTMLDivElement>(null);
        const mountedRef = useRef<ReturnType<typeof mount> | null>(null);

        useLayoutEffect(() => {
            // Prevent double-mounting in StrictMode if already mounted
            if (mountedRef.current) {
                return;
            }

            if (svelteRef.current) {
                // Clear any existing children
                while (svelteRef.current.firstChild) {
                    svelteRef.current.firstChild.remove();
                }
                
                mountedRef.current = mount(Component, {
                    target: svelteRef.current,
                    props,
                });
            }

            // Cleanup function to properly unmount the Svelte component
            return () => {
                if (mountedRef.current) {
                    unmount(mountedRef.current);
                    mountedRef.current = null;
                }
            };
        }, []);

        return <div style={{ height: "100%", width: "100%" }} ref={svelteRef}></div>;
    }
    SvelteWrapper.displayName = 'SvelteWrapper';
    return SvelteWrapper;
}