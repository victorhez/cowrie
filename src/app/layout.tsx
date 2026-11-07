import type { Metadata } from "next";
import { Unbounded, Manrope } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const display = Unbounded({ subsets: ["latin"], variable: "--font-display", weight: ["500", "700", "900"] });
const body = Manrope({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Cowrie: savings circles on NEAR",
  description:
    "Rotating savings circles (ajo, esusu, susu) where the rules are code and the history is proof. Collateral and safety pot chosen from published simulations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
