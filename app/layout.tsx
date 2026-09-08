import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Stringshift — Guitar to Mandolin Tab Studio',description:'Convert guitar tabs into mandolin arrangements with custom tunings, key changes, synth playback, and printable PDF export.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en" className="dark"><body>{children}</body></html>}
