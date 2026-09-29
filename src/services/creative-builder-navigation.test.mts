import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = (path:string) => readFile(new URL(path,import.meta.url),'utf8');

test('Creative Builder canonical page preserves existing authorization instead of bypassing it',async()=>{
 const page=await source('../app/dashboard/eicagency/creative-builder/page.tsx');
 assert.match(page,/export \{ default \} from '\.\.\/creative-studio\/page'/);
 assert.match(page,/dynamic = 'force-dynamic'/);
 const protectedPage=await source('../app/dashboard/eicagency/creative-studio/page.tsx');
 assert.match(protectedPage,/await authorizeStudioServer\(process.env, createClient\)/);
 assert.match(protectedPage,/await requireClientAccess\('eicagency'\)/);
 assert.doesNotMatch(protectedPage,/requireAgencyAccess/);
});
test('navigation is default hidden and uses server-authorized capability with no public allowlist',async()=>{
 const layout=await source('../app/dashboard/layout.tsx');
 assert.match(layout,/name: 'Creative Builder', href: '\/dashboard\/eicagency\/creative-builder'/);
 const entry=layout.split('\n').find(line=>line.includes("name: 'Creative Builder'"))!;
 assert.doesNotMatch(entry,/agencyOnly|privateToFullName/);
 assert.match(layout,/\[creativeBuilderEnabled, setCreativeBuilderEnabled\] = useState\(false\)/);
 assert.match(layout,/creativeBuilderOnly && !creativeBuilderEnabled\) return false/);
 const endpoint=await source('../app/api/creative-studio/access/route.ts');
 assert.match(endpoint,/let enabled = false/);
 assert.match(endpoint,/await authorizeStudioServer\(process.env, createClient\)/);
 assert.match(endpoint,/private, no-store/);
 assert.doesNotMatch(endpoint,/hostedStudioServer\(/);
});
test('visible builder title matches the requested product name',async()=>{
 const ui=await source('../components/creative-studio/CreativeStudio.tsx');
 assert.match(ui,/aria-label="Creative Builder"/);
 assert.match(ui,/<h1>Creative Builder<span/);
});
