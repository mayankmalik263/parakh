import type { Metadata } from "next";
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Interactions from "@/components/motion/Interactions";
import "./globals.css";

// Headlines: Instrument Serif (one weight, with a real italic for accent words).
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

// Everything else: Inter Tight.
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

// Code blocks only.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Parakh | Your own AI co-founder",
  description:
    "Type one sentence about your startup idea. Four AI agents write a build plan with real tools and prices, code checks the math, then a Critic sends back whatever won't hold up.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${interTight.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Interactions />
        <Analytics />
      </body>
    </html>
  );
}
