import React, { Suspense } from 'react';
import PlannerClientPage from '../PlannerClientPage';

export default function PlannerPage() {
  return (
    <Suspense fallback={null}>
      <PlannerClientPage />
    </Suspense>
  );
}
