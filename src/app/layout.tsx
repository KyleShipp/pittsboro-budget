import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pittsboro Budget Explorer',
  description:
    'Explore the Town of Pittsboro budget by department, revenue source, and line item. Compare years, see your property tax receipt, and browse the capital improvement plan.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
        <footer className="border-t mt-12 py-6 text-center text-sm text-gray-500">
          <p>
            An independent civic data tool. Not an official Town of Pittsboro
            publication.
          </p>
          <p className="mt-1">
            Data from published budget documents &middot;{' '}
            <a
              href="https://www.pittsboronc.gov"
              className="underline hover:text-gray-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              pittsboronc.gov
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
