import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';

export default function HomePage() {
  const { userId } = auth();

  if (userId) {
    redirect('/planner');
  }

  return (
    <main>
      <section className="landing-hero">
        <p className="landing-kicker">Revenue Ninja</p>
        <h1>Revenue planning without spreadsheet chaos</h1>
        <p className="landing-description">
          Build demand, pipeline, SDR, and sales capacity plans in one place.
          Sign in to access your workspace and generate clear, shareable plans.
        </p>
        <div className="landing-actions">
          <SignInButton mode="modal">
            <button type="button" className="button">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button type="button" className="button button-secondary">
              Create account
            </button>
          </SignUpButton>
          <Link href="/sign-in" className="landing-text-link">
            Open dedicated sign-in page
          </Link>
        </div>
      </section>

      <section className="landing-grid">
        <article className="panel">
          <div className="panel-title">Demand Generation</div>
          <p className="landing-card-copy">
            Plan MQL volume and pipeline creation with clear funnel assumptions.
          </p>
        </article>
        <article className="panel">
          <div className="panel-title">Pipeline Planner</div>
          <p className="landing-card-copy">
            Translate revenue goals into weekly pipeline and opportunity targets.
          </p>
        </article>
        <article className="panel">
          <div className="panel-title">Capacity Planners</div>
          <p className="landing-card-copy">
            Model SDR and sales headcount, ramp, and quota coverage against goals.
          </p>
        </article>
      </section>
    </main>
  );
}

