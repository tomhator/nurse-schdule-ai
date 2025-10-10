import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "간호사 근무표 생성 시스템",
  description: "간호사 근무표 자동 생성 및 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}