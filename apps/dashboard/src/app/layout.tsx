import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kroxy — AI Agent Economy',
  description: 'Conditional escrow, job board, and arbitration for AI agents on Base',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#07070f] text-white">{children}</body>
    </html>
  );
}
