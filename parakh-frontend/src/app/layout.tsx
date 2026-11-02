import type { Metadata } from "next";
import { Anton, DM_Sans, DM_Mono, Tiro_Devanagari_Hindi } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Interactions from "@/components/motion/Interactions";
import "./globals.css";

// Headlines: Anton, a condensed poster face, always uppercase.
const anton = Anton({ variable: "--font-anton", subsets: ["latin", "latin-ext"], weight: "400" });

// Body copy and UI.
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin", "latin-ext"] });

// Numbers, formulas and code.
const dmMono = DM_Mono({ variable: "--font-dm-mono", subsets: ["latin"], weight: ["400", "500"] });

// The परख in the logo and stamps.
const tiroDeva = Tiro_Devanagari_Hindi({ variable: "--font-tiro-deva", subsets: ["devanagari", "latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Parakh | Your own AI co-founder",
  description:
    "Write your startup idea in one line. Four AI agents plan it in rupees, code checks every number, and a Critic tells you what won't work. Made for student founders in India.",
};

export const viewport = { themeColor: "#FFF3DC" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${dmSans.variable} ${dmMono.variable} ${tiroDeva.variable} h-full antialiased`}
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
