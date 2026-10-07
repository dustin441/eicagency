// Static local-review assets only; not full campaign or PMax readiness.
export const LEGACY_RATIOS = ['1:1','4:5','9:16','16:9'] as const;
export const RATIOS = [...LEGACY_RATIOS,'google-landscape','google-square','google-portrait','logo-square','logo-wide','300x250','336x280','728x90','160x600','300x600','320x50','320x100','970x250'] as const;
export type Ratio = typeof RATIOS[number];
export type Placement = {width:number;height:number;insetX:number;insetY:number;name:string;family:'meta'|'google-image'|'logo'|'banner';mimeType:'image/png'|'image/jpeg';extension:'png'|'jpg';maxBytes:number};
const placement=(width:number,height:number,insetX:number,insetY:number,name:string,family:Placement['family']):Placement=>({width,height,insetX,insetY,name,family,mimeType:family==='banner'?'image/jpeg':'image/png',extension:family==='banner'?'jpg':'png',maxBytes:family==='banner'?150*1024:family==='meta'?30*1024*1024:5*1024*1024});
export const PLACEMENTS:Record<Ratio,Placement>={
 '1:1':placement(1080,1080,60,60,'Square feed','meta'),
 '4:5':placement(1080,1350,64,70,'Portrait feed','meta'),
 '9:16':placement(1080,1920,90,260,'Story / Reel draft','meta'),
 '16:9':placement(1920,1080,90,70,'Legacy landscape','meta'),
 'google-landscape':placement(1200,628,48,40,'Google landscape image','google-image'),
 'google-square':placement(1200,1200,60,60,'Google square image','google-image'),
 'google-portrait':placement(960,1200,48,60,'Google portrait image','google-image'),
 'logo-square':placement(1200,1200,120,120,'Original logo · square','logo'),
 'logo-wide':placement(1200,300,60,30,'Original logo · wide (optional)','logo'),
 '300x250':placement(300,250,14,14,'Medium rectangle · 300 × 250','banner'),
 '336x280':placement(336,280,16,16,'Large rectangle · 336 × 280','banner'),
 '728x90':placement(728,90,12,10,'Leaderboard · 728 × 90','banner'),
 '160x600':placement(160,600,12,20,'Wide skyscraper · 160 × 600','banner'),
 '300x600':placement(300,600,20,24,'Half page · 300 × 600','banner'),
 '320x50':placement(320,50,8,6,'Mobile banner · 320 × 50','banner'),
 '320x100':placement(320,100,10,8,'Large mobile banner · 320 × 100','banner'),
 '970x250':placement(970,250,24,20,'Billboard · 970 × 250','banner'),
};
export const PACK_IDS=['meta-images','meta-feed','google-assets','google-banners','meta-google-images'] as const;
export type PackId=typeof PACK_IDS[number];
export type Pack={name:string;description:string;placements:readonly Ratio[]};
export const PACKS:Record<PackId,Pack>={
 'meta-feed':{name:'Meta feed concepts',description:'Square and portrait feed only. Concepts do not support Stories, Reels or Google packs.',placements:['1:1','4:5']},
 'meta-images':{name:'Meta images',description:'Three static feed/story drafts. No video or publishing.',placements:['1:1','4:5','9:16']},
 'google-assets':{name:'Google image + logo assets',description:'Clean illustrative images and original logos for separate text assets. Not a complete PMax campaign.',placements:['google-landscape','google-square','google-portrait','logo-square','logo-wide']},
 'google-banners':{name:'Google static banners',description:'Eight fixed-size JPEG banners, each at most 150 KB. Placement-specific concise copy.',placements:['300x250','336x280','728x90','160x600','300x600','320x50','320x100','970x250']},
 'meta-google-images':{name:'Meta + Google images',description:'PNG-only Meta placements plus Google image and logo assets. No JPEG banners, video or publishing.',placements:['1:1','4:5','9:16','google-landscape','google-square','google-portrait','logo-square','logo-wide']},
};
export function getPack<T extends object>(brief:T & {pack?:PackId}):Pack {return PACKS[brief.pack??'meta-images'];}
export type CreativeChannel='meta'|'google'|'both';
export function channelForPack(pack:PackId):CreativeChannel {
 return pack==='meta-google-images'?'both':pack.startsWith('google-')?'google':'meta';
}
export function packForChannel(channel:CreativeChannel,scene:{template:string}):PackId|null {
 const feedOnly=scene.template!=='launch-tracker-v1';
 if(feedOnly)return channel==='meta'?'meta-feed':null;
 return channel==='meta'?'meta-images':channel==='google'?'google-assets':'meta-google-images';
}
