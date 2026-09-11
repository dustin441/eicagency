export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_DATA: FaqItem[] = [
  {
    q: 'Is the ROI Calculator free?',
    a: 'Yes, completely free! There are no hidden fees, credit card requirements, or strings attached. You get a comprehensive analysis report delivered straight to your inbox.',
  },
  {
    q: 'Do I need to provide my phone number?',
    a: 'No. We respect your privacy and focus entirely on providing value. We will never ask for your phone number or call you without your permission.',
  },
  {
    q: 'How is the ROI estimate calculated?',
    a: "Your report combines your inputs with relevant acquisition benchmarks where available. When evidence for your industry is limited, it uses a clearly identified comparable-business model or planning assumptions. Confidence labels and sensitivity ranges explain the evidence behind your estimate.",
  },
  {
    q: 'When will I receive my report?',
    a: 'Your report is emailed after the analysis is complete. Delivery time can vary. Check your spam folder, and contact dustin@eic.agency if you need help.',
  },
  {
    q: 'What information do I need to provide?',
    a: 'Share your company name, your name, work email, website, advertising platforms, monthly ad budget, average purchase price, purchases per year, and industry. For subscriptions or retainers, use one payment as the purchase price and the number of payments per year (12 for monthly payments); use 1 for a one-time purchase. No sensitive financial credentials or access permissions required.',
  },
  {
    q: 'Is the result a guarantee or an estimate?',
    a: 'The report is a directional 12-month planning scenario, not a prediction or guarantee. Evidence confidence describes the strength and relevance of the sources, not the probability of achieving the forecast. Your actual customer acquisition, repeat purchases, and business costs will affect results.',
  },
];
