export type SkillCategory =
  | 'language'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'cloud'
  | 'devops'
  | 'practice';

export interface SkillDefinition {
  /** Canonical name, as displayed in the UI and stored on JobSkill/Profile. */
  name: string;
  category: SkillCategory;
  /** Alternate spellings a JD might use, mapped back to `name` when extracting. */
  aliases: string[];
}

/**
 * Curated skill taxonomy for extraction, profile matching, and market
 * insights. Weighted toward the stack the project owner is targeting
 * (React/NestJS/TypeScript/PostgreSQL/AWS) plus enough breadth to cover
 * common adjacent JD vocabulary.
 */
export const SKILL_TAXONOMY: SkillDefinition[] = [
  // --- language ---------------------------------------------------------
  { name: 'javascript', category: 'language', aliases: ['js'] },
  { name: 'typescript', category: 'language', aliases: ['ts'] },
  { name: 'python', category: 'language', aliases: ['py'] },
  { name: 'java', category: 'language', aliases: [] },
  { name: 'go', category: 'language', aliases: ['golang'] },
  { name: 'c++', category: 'language', aliases: ['cpp'] },
  { name: 'c#', category: 'language', aliases: ['csharp', 'c sharp'] },
  { name: 'php', category: 'language', aliases: [] },
  { name: 'ruby', category: 'language', aliases: [] },
  { name: 'rust', category: 'language', aliases: [] },
  { name: 'kotlin', category: 'language', aliases: [] },
  { name: 'swift', category: 'language', aliases: [] },
  { name: 'sql', category: 'language', aliases: [] },
  { name: 'html', category: 'language', aliases: ['html5'] },
  { name: 'css', category: 'language', aliases: ['css3'] },

  // --- frontend -----------------------------------------------------------
  { name: 'react', category: 'frontend', aliases: ['reactjs', 'react.js'] },
  { name: 'nextjs', category: 'frontend', aliases: ['next.js'] },
  { name: 'vue', category: 'frontend', aliases: ['vuejs', 'vue.js'] },
  { name: 'angular', category: 'frontend', aliases: ['angularjs'] },
  { name: 'svelte', category: 'frontend', aliases: [] },
  { name: 'redux', category: 'frontend', aliases: [] },
  { name: 'tailwindcss', category: 'frontend', aliases: ['tailwind'] },
  { name: 'webpack', category: 'frontend', aliases: [] },
  { name: 'vite', category: 'frontend', aliases: [] },
  { name: 'sass', category: 'frontend', aliases: ['scss'] },
  { name: 'less', category: 'frontend', aliases: [] },
  { name: 'jquery', category: 'frontend', aliases: [] },
  { name: 'bootstrap', category: 'frontend', aliases: [] },
  { name: 'material-ui', category: 'frontend', aliases: ['mui'] },
  { name: 'storybook', category: 'frontend', aliases: [] },
  { name: 'progressive web apps', category: 'frontend', aliases: ['pwa'] },
  { name: 'webassembly', category: 'frontend', aliases: ['wasm'] },
  { name: 'responsive design', category: 'frontend', aliases: [] },
  { name: 'accessibility', category: 'frontend', aliases: ['a11y'] },
  { name: 'web performance', category: 'frontend', aliases: [] },

  // --- backend -----------------------------------------------------------
  { name: 'node', category: 'backend', aliases: ['nodejs', 'node.js'] },
  { name: 'express', category: 'backend', aliases: ['expressjs', 'express.js'] },
  { name: 'nestjs', category: 'backend', aliases: ['nest.js'] },
  { name: 'django', category: 'backend', aliases: [] },
  { name: 'flask', category: 'backend', aliases: [] },
  { name: 'fastapi', category: 'backend', aliases: [] },
  { name: 'spring', category: 'backend', aliases: ['spring boot'] },
  { name: 'rails', category: 'backend', aliases: ['ruby on rails'] },
  { name: 'laravel', category: 'backend', aliases: [] },
  { name: 'dotnet', category: 'backend', aliases: ['.net', 'asp.net'] },
  { name: 'graphql', category: 'backend', aliases: [] },
  { name: 'rest', category: 'backend', aliases: ['restful', 'rest api'] },
  { name: 'grpc', category: 'backend', aliases: [] },
  { name: 'websockets', category: 'backend', aliases: ['websocket', 'socket.io'] },
  { name: 'kafka', category: 'backend', aliases: ['apache kafka'] },
  { name: 'rabbitmq', category: 'backend', aliases: [] },
  { name: 'microservices', category: 'backend', aliases: [] },
  { name: 'api design', category: 'backend', aliases: [] },
  { name: 'prisma', category: 'backend', aliases: [] },
  { name: 'typeorm', category: 'backend', aliases: [] },
  { name: 'sequelize', category: 'backend', aliases: [] },
  { name: 'mongoose', category: 'backend', aliases: [] },

  // --- database -----------------------------------------------------------
  { name: 'postgresql', category: 'database', aliases: ['postgres', 'psql'] },
  { name: 'mysql', category: 'database', aliases: [] },
  { name: 'mariadb', category: 'database', aliases: [] },
  { name: 'mongodb', category: 'database', aliases: ['mongo'] },
  { name: 'redis', category: 'database', aliases: [] },
  { name: 'elasticsearch', category: 'database', aliases: ['elastic search', 'es'] },
  { name: 'sqlite', category: 'database', aliases: [] },
  { name: 'dynamodb', category: 'database', aliases: [] },
  { name: 'cassandra', category: 'database', aliases: [] },
  { name: 'oracle database', category: 'database', aliases: ['oracle db'] },
  { name: 'sql server', category: 'database', aliases: ['mssql', 'microsoft sql server'] },
  { name: 'neo4j', category: 'database', aliases: [] },
  { name: 'database design', category: 'database', aliases: [] },
  { name: 'database indexing', category: 'database', aliases: ['indexing'] },
  { name: 'database migrations', category: 'database', aliases: ['db migrations'] },

  // --- cloud -----------------------------------------------------------
  {
    name: 'aws',
    category: 'cloud',
    aliases: [
      'amazon web services',
      'ec2',
      's3',
      'lambda',
      'rds',
      'cloudfront',
      'sqs',
      'sns',
      'iam',
      'vpc',
    ],
  },
  { name: 'gcp', category: 'cloud', aliases: ['google cloud', 'google cloud platform'] },
  { name: 'azure', category: 'cloud', aliases: ['microsoft azure'] },
  { name: 'vercel', category: 'cloud', aliases: [] },
  { name: 'netlify', category: 'cloud', aliases: [] },
  { name: 'heroku', category: 'cloud', aliases: [] },
  { name: 'digitalocean', category: 'cloud', aliases: ['digital ocean'] },
  { name: 'cloudflare', category: 'cloud', aliases: [] },
  { name: 'firebase', category: 'cloud', aliases: [] },
  { name: 'supabase', category: 'cloud', aliases: [] },
  { name: 'serverless', category: 'cloud', aliases: [] },
  { name: 'cdn', category: 'cloud', aliases: ['content delivery network'] },

  // --- devops -----------------------------------------------------------
  { name: 'docker', category: 'devops', aliases: [] },
  { name: 'kubernetes', category: 'devops', aliases: ['k8s'] },
  { name: 'terraform', category: 'devops', aliases: [] },
  { name: 'ansible', category: 'devops', aliases: [] },
  { name: 'ci/cd', category: 'devops', aliases: ['cicd', 'continuous integration', 'continuous deployment'] },
  { name: 'jenkins', category: 'devops', aliases: [] },
  { name: 'github actions', category: 'devops', aliases: [] },
  { name: 'gitlab ci', category: 'devops', aliases: [] },
  { name: 'circleci', category: 'devops', aliases: [] },
  { name: 'prometheus', category: 'devops', aliases: [] },
  { name: 'grafana', category: 'devops', aliases: [] },
  { name: 'nginx', category: 'devops', aliases: [] },
  { name: 'linux', category: 'devops', aliases: [] },
  { name: 'bash', category: 'devops', aliases: ['shell scripting', 'shell'] },
  { name: 'git', category: 'devops', aliases: [] },
  { name: 'monitoring', category: 'devops', aliases: [] },
  { name: 'logging', category: 'devops', aliases: [] },
  { name: 'infrastructure as code', category: 'devops', aliases: ['iac'] },
  { name: 'load balancing', category: 'devops', aliases: [] },
  { name: 'helm', category: 'devops', aliases: [] },

  // --- practice -----------------------------------------------------------
  { name: 'system design', category: 'practice', aliases: [] },
  { name: 'oop', category: 'practice', aliases: ['object oriented programming'] },
  { name: 'design patterns', category: 'practice', aliases: [] },
  { name: 'solid principles', category: 'practice', aliases: ['solid'] },
  { name: 'agile', category: 'practice', aliases: [] },
  { name: 'scrum', category: 'practice', aliases: [] },
  { name: 'tdd', category: 'practice', aliases: ['test driven development'] },
  { name: 'unit testing', category: 'practice', aliases: [] },
  { name: 'integration testing', category: 'practice', aliases: [] },
  { name: 'jest', category: 'practice', aliases: [] },
  { name: 'vitest', category: 'practice', aliases: [] },
  { name: 'cypress', category: 'practice', aliases: [] },
  { name: 'playwright', category: 'practice', aliases: [] },
  { name: 'code review', category: 'practice', aliases: [] },
  { name: 'clean code', category: 'practice', aliases: [] },
];

const skillByName = new Map(SKILL_TAXONOMY.map((s) => [s.name, s]));

/** Maps an alias (or canonical name) to its canonical skill name, if known. */
export const ALIAS_TO_SKILL: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const skill of SKILL_TAXONOMY) {
    map.set(skill.name, skill.name);
    for (const alias of skill.aliases) {
      map.set(alias, skill.name);
    }
  }
  return map;
})();

export function isKnownSkill(name: string): boolean {
  return skillByName.has(name);
}

export function getSkillCategory(name: string): SkillCategory | undefined {
  return skillByName.get(name)?.category;
}
