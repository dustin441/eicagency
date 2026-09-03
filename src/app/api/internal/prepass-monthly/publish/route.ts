import { createPrepassMonthlyPublishPostHandler } from './route-handler.ts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export const POST = createPrepassMonthlyPublishPostHandler();
