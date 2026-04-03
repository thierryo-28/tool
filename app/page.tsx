import React, { Suspense } from 'react';
import PlannerClientPage from './PlannerClientPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PlannerClientPage />
    </Suspense>
  );
}

