export const progressMetrics = [
  { label: 'Debates completed', value: '0', change: 'No sessions yet', tone: 'blue' },
  { label: 'Arguments analyzed', value: '0', change: 'No arguments yet', tone: 'green' },
  { label: 'Avg. persuasiveness', value: '0%', change: 'No score yet', tone: 'amber' },
  { label: 'Current streak', value: '0 days', change: 'No activity today', tone: 'red' },
]

export const recentSessions = []

export const achievements = [
  {
    title: 'Reasoning Scholar',
    description: 'Analyze 50 arguments',
    progress: 0,
    status: 'In progress',
    tone: 'blue',
  },
  {
    title: 'Debate Builder',
    description: 'Complete 10 debate sessions',
    progress: 0,
    status: 'In progress',
    tone: 'green',
  },
  {
    title: 'Persuasion Peak',
    description: 'Reach a 90% average score',
    progress: 0,
    status: 'In progress',
    tone: 'amber',
  },
]

export const teamMembers = []

export const sharedArguments = []

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

export const progressSeries = []

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
  topic: 'No session selected',
  score: 0,
  recommendation: 'Analyze a real argument to generate a personalized recommendation.',
  keyArguments: [
    'No real session data has been recorded yet.',
  ],
  evidence: [
    'Add sources in an analysis to review evidence quality.',
  ],
  fallacies: [
    'Logical risks will appear after a real analysis is saved.',
  ],
  counterarguments: [
    'Counterarguments will appear after a real analysis is saved.',
  ],
}
