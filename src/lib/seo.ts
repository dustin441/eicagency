export const SITE_URL = 'https://eic.agency';
export const SITE_NAME = 'EIC Agency';
export const SOCIAL_IMAGE = '/og-eic-white-label-paid-media.png';
export const SOCIAL_IMAGE_URL = `${SITE_URL}${SOCIAL_IMAGE}`;
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export const organizationSchema = {
  '@type': ['Organization', 'ProfessionalService'],
  '@id': ORGANIZATION_ID,
  name: SITE_NAME,
  legalName: 'Every Impression Counts LLC',
  url: SITE_URL,
  logo: `${SITE_URL}/favicon-256.png`,
  image: SOCIAL_IMAGE_URL,
  description:
    'EIC Agency provides white-label paid media strategy, campaign execution, creative production, reporting, and optimization for marketing agencies.',
  email: 'eic@eic.agency',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Tempe',
    addressRegion: 'AZ',
    addressCountry: 'US',
  },
  areaServed: {
    '@type': 'Country',
    name: 'United States',
  },
  sameAs: [
    'https://www.linkedin.com/company/every-impression-counts',
    'https://www.instagram.com/everyimpressioncounts/',
    'https://www.facebook.com/EveryImpressionCounts',
    'https://www.youtube.com/@EICAgency',
  ],
};

export const websiteSchema = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: SITE_URL,
  name: SITE_NAME,
  publisher: { '@id': ORGANIZATION_ID },
  inLanguage: 'en-US',
};

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
