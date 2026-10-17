import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CrossPointer Controller',
  description: 'A private, local-first trackpad and presentation controller.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
