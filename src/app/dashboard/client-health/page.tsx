import { notFound } from 'next/navigation';

export default function ClientHealthPage() {
  // Keep this route unavailable until it reads only reconciled, published snapshots.
  notFound();
}
