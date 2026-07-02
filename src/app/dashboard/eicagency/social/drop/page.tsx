import React from 'react';
import { requireClientAccess } from '@/lib/auth-guard';
import EicContentDropClient from './EicContentDropClient';

export default async function EicAgencySocialDropPage() {
  await requireClientAccess('eicagency');
  return <EicContentDropClient />;
}
