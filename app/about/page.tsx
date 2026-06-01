import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us | Revenue Ninja',
  description:
    'Revenue Ninja is your command center for smarter revenue planning.'
};

export default function AboutPage() {
  return (
    <main>
      <section className="landing-hero">
        <p className="landing-kicker">Revenue Ninja</p>
        <h1>About us</h1>
        <p className="landing-description">
          Revenue Ninja is your command center for smarter revenue planning. From
          headcount and sales capacity to pipeline coverage and demand generation,
          it gives sales leaders and RevOps teams the clarity to plan faster,
          allocate resources confidently, and hit targets with precision—no
          spreadsheets, no guesswork, just execution.
        </p>
      </section>
    </main>
  );
}
