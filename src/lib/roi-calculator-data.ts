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
    a: "Our system combines real market benchmark data from EIC's cross-channel database (including customer acquisition costs, industry conversion standards, and click-through benchmarks) with the specific numbers you enter about your business.",
  },
  {
    q: 'When will I receive my report?',
    a: 'Your custom ROI analysis is processed immediately and delivered directly to your email in less than 10 minutes.',
  },
  {
    q: 'What information do I need to provide?',
    a: 'Only basic operational parameters such as your company name, email address, current monthly ad spend, average order value, and industry. No sensitive financial credentials or access permissions required.',
  },
  {
    q: 'Is the result a guarantee or an estimate?',
    a: 'The report provides a realistic estimate based on statistical market benchmarks and your inputs. It serves as an objective baseline for strategic planning rather than a contractual guarantee.',
  },
];
