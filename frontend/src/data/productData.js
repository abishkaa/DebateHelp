export const progressMetrics = [
  { label: 'Debates completed', value: '47', change: '+12%', tone: 'blue' },
  { label: 'Arguments analyzed', value: '1,238', change: '+18%', tone: 'green' },
  { label: 'Avg. persuasiveness', value: '81%', change: '+7%', tone: 'amber' },
  { label: 'Current streak', value: '6 days', change: 'Best: 12 days', tone: 'red' },
]

export const recentSessions = [
  {
    id: 'healthcare',
    title: 'Healthcare Debate',
    topic: 'Universal Healthcare',
    score: 89,
    date: 'Today, 10:24 AM',
    trend: '+6',
  },
  {
    id: 'ubi',
    title: 'Universal Basic Income',
    topic: 'Economic Policy',
    score: 74,
    date: 'Jun 22, 3:15 PM',
    trend: '+2',
  },
  {
    id: 'ai-regulation',
    title: 'AI Regulation',
    topic: 'Technology Policy',
    score: 82,
    date: 'Jun 20, 11:08 AM',
    trend: '+8',
  },
  {
    id: 'climate-policy',
    title: 'Climate Policy',
    topic: 'Carbon Pricing',
    score: 78,
    date: 'Jun 17, 4:42 PM',
    trend: '-1',
  },
  {
    id: 'education',
    title: 'Education Reform',
    topic: 'Standardized Testing',
    score: 85,
    date: 'Jun 14, 9:30 AM',
    trend: '+4',
  },
]

export const achievements = [
  {
    title: 'Reasoning Scholar',
    description: 'Completed 50 analyses',
    progress: 100,
    status: 'Earned',
    tone: 'blue',
  },
  {
    title: 'Evidence Specialist',
    description: '90% evidence quality',
    progress: 90,
    status: 'Earned',
    tone: 'green',
  },
  {
    title: 'Counterargument Master',
    description: 'Generated 500 rebuttals',
    progress: 100,
    status: 'Earned',
    tone: 'amber',
  },
]

export const teamMembers = [
  { name: 'Abish Abdikalikov', initials: 'AA', role: 'Team lead', status: 'editing', tone: 'green' },
  { name: 'Sarah Chen', initials: 'SC', role: 'Evidence reviewer', status: 'reviewing', tone: 'blue' },
  { name: 'Daniel Kim', initials: 'DK', role: 'Researcher', status: 'online', tone: 'amber' },
  { name: 'Maya Ortiz', initials: 'MO', role: 'Speaker', status: 'offline', tone: 'muted' },
  { name: 'Noah Williams', initials: 'NW', role: 'Coach', status: 'online', tone: 'green' },
]

export const sharedArguments = [
  {
    title: 'Risk-based regulation protects innovation',
    owner: 'Abish',
    quality: 88,
    citations: 6,
    status: 'Ready',
  },
  {
    title: 'Mandatory audits improve accountability',
    owner: 'Sarah',
    quality: 81,
    citations: 4,
    status: 'Review',
  },
  {
    title: 'Open-source models reduce concentration risk',
    owner: 'Daniel',
    quality: 73,
    citations: 3,
    status: 'Draft',
  },
]

export const citationSources = [
  {
    source: 'Harvard Study',
    detail: 'Peer-reviewed policy research',
    credibility: 96,
    tone: 'green',
  },
  {
    source: 'Wikipedia',
    detail: 'Useful overview, verify primary references',
    credibility: 71,
    tone: 'amber',
  },
  {
    source: 'Blog Post',
    detail: 'Unverified author and methodology',
    credibility: 43,
    tone: 'red',
  },
]

export const progressSeries = [68, 61, 56, 82, 86, 71, 59, 65, 74, 74, 81, 76, 70, 70, 80, 72, 60, 55, 63, 63, 74, 74, 83, 69, 75, 81]

export const famousDebates = [
  {
    title: 'Lincoln-Douglas Debates',
    description: 'Study framing, moral claims, and rebuttal structure.',
  },
  {
    title: 'Churchill Speeches',
    description: 'Explore persuasive rhythm, urgency, and public resolve.',
  },
  {
    title: 'Socratic Dialogues',
    description: 'Practice questioning assumptions and defining terms.',
  },
]

export const reportTemplate = {
  topic: 'Universal Healthcare',
  score: 89,
  recommendation: 'Keep the equity framing, add cost evidence, and address implementation risk directly.',
  keyArguments: [
    'Universal access improves population health and reduces delayed care.',
    'Shared risk pools can lower administrative waste and bargaining costs.',
  ],
  evidence: [
    'WHO comparative health systems report - high credibility.',
    'Lancet population health study - high credibility.',
    'Cost projections require a country-specific funding model.',
  ],
  fallacies: [
    'Avoid implying every universal system has identical outcomes.',
    'Separate access claims from claims about total national cost.',
  ],
  counterarguments: [
    'Rapid implementation could strain provider capacity.',
    'Tax incidence and transition costs need explicit treatment.',
  ],
}
