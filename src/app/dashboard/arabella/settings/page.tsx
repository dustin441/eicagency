import React from 'react';
import ClientSettingsPage from '@/components/ClientSettingsPage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return <ClientSettingsPage clientId="arabella" />;
}
