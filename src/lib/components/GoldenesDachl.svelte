<script lang="ts">
	// Das Goldene Dachl als Wappen der App: vergoldete Schindeln ueber dem Erker.
	// Bewusst grob gezeichnet - vier Reihen grosser Schindeln statt vieler
	// kleiner, sonst verschmiert es in Favicon-Groesse zu einem Klecks.
	let { size = 32 }: { size?: number } = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={size} height={size} role="img" aria-label="Goldenes Dachl">
	<defs>
		<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#f6dc93"/>
			<stop offset="0.55" stop-color="#d9a625"/>
			<stop offset="1" stop-color="#a97708"/>
		</linearGradient>
	</defs>
	<!-- Erker: Fassade mit Freskenband und drei Bogenfenstern -->
	<rect x="12" y="28.5" width="24" height="16.5" rx="1" fill="#f7fafc" stroke="#9fb6c8" stroke-width="0.9"/>
	<rect x="12" y="28.5" width="24" height="4" fill="#2b7fb8"/>
	<g fill="#2b7fb8">
		<path d="M15.8 43v-5.6a2.5 2.5 0 0 1 5 0V43z"/>
		<path d="M21.5 43v-5.6a2.5 2.5 0 0 1 5 0V43z"/>
		<path d="M27.2 43v-5.6a2.5 2.5 0 0 1 5 0V43z"/>
	</g>
	<!-- First -->
	<path d="M24 5.2 13.6 11.2h20.8z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.45"/>
	<!-- Goldene Schindeln -->
	<g>
		<path d="M14.00 11.00 h6.67 v1.68 a3.33 2.52 0 0 1 -6.67 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M20.67 11.00 h6.67 v1.68 a3.33 2.52 0 0 1 -6.67 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M27.33 11.00 h6.67 v1.68 a3.33 2.52 0 0 1 -6.67 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M11.67 15.20 h6.17 v1.68 a3.08 2.52 0 0 1 -6.17 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M17.83 15.20 h6.17 v1.68 a3.08 2.52 0 0 1 -6.17 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M24.00 15.20 h6.17 v1.68 a3.08 2.52 0 0 1 -6.17 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M30.17 15.20 h6.17 v1.68 a3.08 2.52 0 0 1 -6.17 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M9.33 19.40 h5.87 v1.68 a2.93 2.52 0 0 1 -5.87 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M15.20 19.40 h5.87 v1.68 a2.93 2.52 0 0 1 -5.87 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M21.07 19.40 h5.87 v1.68 a2.93 2.52 0 0 1 -5.87 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M26.93 19.40 h5.87 v1.68 a2.93 2.52 0 0 1 -5.87 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M32.80 19.40 h5.87 v1.68 a2.93 2.52 0 0 1 -5.87 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M7.00 23.60 h5.67 v1.68 a2.83 2.52 0 0 1 -5.67 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M12.67 23.60 h5.67 v1.68 a2.83 2.52 0 0 1 -5.67 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M18.33 23.60 h5.67 v1.68 a2.83 2.52 0 0 1 -5.67 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M24.00 23.60 h5.67 v1.68 a2.83 2.52 0 0 1 -5.67 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M29.67 23.60 h5.67 v1.68 a2.83 2.52 0 0 1 -5.67 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
		<path d="M35.33 23.60 h5.67 v1.68 a2.83 2.52 0 0 1 -5.67 0 z" fill="url(#gold)" stroke="#8a6508" stroke-width="0.4"/>
	</g>
</svg>

<style>
	svg {
		flex: none;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
	}
</style>
