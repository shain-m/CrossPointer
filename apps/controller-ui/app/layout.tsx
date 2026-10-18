import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CrossPointer Controller',
  description: 'A private, local-first trackpad and presentation controller.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
