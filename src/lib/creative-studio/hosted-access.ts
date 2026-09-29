import { z } from 'zod';
import type { VerifiedStudioContext } from '../../services/creative-studio-repository.ts';

const OwnerId = z.string().uuid();
const Config = z.object({ enabled: z.boolean() }).strict();
export type HostedStudioAccessConfig = z.infer<typeof Config>;
export type StudioProfile = { role: string; client_access: string[] | null };
export function hasStudioClientAccess(profile: StudioProfile | null): boolean {
 return !!profile && (profile.role === 'agency' || profile.role === 'super_admin' ||
  (profile.role === 'client' && Array.isArray(profile.client_access) && profile.client_access.includes('eicagency')));
}
export class HostedStudioAccessError extends Error {
 readonly status:number;
 constructor(status:number){super(status===401?'Authentication required.':status===403?'Creative Studio access denied.':'Creative Studio unavailable.');this.status=status;this.name='HostedStudioAccessError';}
}
/** Operational feature flag only. Existing protected client access determines eligibility. */
export function hostedStudioAccessConfig(env: Record<string,string|undefined>): HostedStudioAccessConfig {
 return { enabled: env.CREATIVE_STUDIO_HOSTED_ENABLED === 'true' };
}
/** Cookie-bound auth.getUser and protected profiles only; never user_metadata. */
export type HostedStudioIdentityLookups = {
 getVerifiedUser: () => Promise<{id:string}|null>;
 getProtectedProfile: (userId:string) => Promise<StudioProfile|null>;
};
export async function authorizeHostedStudio(input: HostedStudioAccessConfig, lookups: HostedStudioIdentityLookups): Promise<VerifiedStudioContext> {
 if(typeof window !== 'undefined') throw new HostedStudioAccessError(403);
 const parsed = Config.safeParse(input);
 if(!parsed.success || !parsed.data.enabled) throw new HostedStudioAccessError(503);
 let user: {id:string}|null;
 try { user = await lookups.getVerifiedUser(); } catch { throw new HostedStudioAccessError(401); }
 if(!user || !OwnerId.safeParse(user.id).success) throw new HostedStudioAccessError(401);
 const id = user.id;
 let profile: StudioProfile|null;
 try { profile = await lookups.getProtectedProfile(id); } catch { throw new HostedStudioAccessError(403); }
 if(!hasStudioClientAccess(profile)) throw new HostedStudioAccessError(403);
 return Object.freeze({tenantId:'eicagency',ownerId:id});
}
