import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Joc — Live Wedding Game Show",
  description: "A live A/B trivia game show for your wedding.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro">
      <body className="antialiased">{children}</body>
    </html>
  );
}
