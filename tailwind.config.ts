import type { Config } from 'tailwindcss'
import { theme } from '@viamrobotics/prime-core/theme'
import { plugins } from '@viamrobotics/prime-core/plugins'

/** @type {import('tailwindcss').Config} */
export default {
	darkMode: 'class',
	content: [
		'./src/**/*.{html,js,svelte,ts}',
		'./node_modules/@viamrobotics/prime-core/**/*.{ts,svelte}',
		'./node_modules/@viamrobotics/motion-tools/dist/**/*.{js,svelte}',
	],
	theme,
	plugins,
} satisfies Config
