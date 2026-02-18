// OSRS XP formula mapped to hours (0-50,000 range)
// RS XP for level L = floor(1/4 * sum(floor(l + 300 * 2^(l/7))) for l = 1 to L-1)
// Hours for level L = RS_XP(L) / 13_034_431 * 50_000

const MAX_LEVEL = 99;
const MAX_XP = 13_034_431;
const MAX_HOURS = 50_000;

function xpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += Math.floor(l + 300 * Math.pow(2, l / 7));
  }
  return Math.floor(total / 4);
}

function hoursForLevel(level: number): number {
  return (xpForLevel(level) / MAX_XP) * MAX_HOURS;
}

export function levelFromHours(hours: number): number {
  for (let l = MAX_LEVEL; l >= 1; l--) {
    if (hours >= hoursForLevel(l)) return l;
  }
  return 1;
}

export function progressToNextLevel(hours: number): { current: number; nextHours: number; currentHours: number; percent: number; isMax: boolean } {
  const level = levelFromHours(hours);
  if (level >= MAX_LEVEL) {
    return { current: MAX_LEVEL, nextHours: 0, currentHours: hoursForLevel(MAX_LEVEL), percent: 100, isMax: true };
  }
  const currentLevelHours = hoursForLevel(level);
  const nextLevelHours = hoursForLevel(level + 1);
  const percent = Math.floor(((hours - currentLevelHours) / (nextLevelHours - currentLevelHours)) * 100);
  return { current: level, nextHours: nextLevelHours, currentHours: currentLevelHours, percent, isMax: false };
}

export function levelDescription(level: number): string {
  if (level >= 99) return "Absolute mastery. This is second nature.";
  if (level >= 90) return "Near mastery. Deep expertise and intuition.";
  if (level >= 80) return "Highly proficient. Can handle complex challenges.";
  if (level >= 70) return "Advanced. Strong command and growing expertise.";
  if (level >= 60) return "Solid. Comfortable with most situations.";
  if (level >= 50) return "Competent. Can hold your own reliably.";
  if (level >= 40) return "Intermediate. Getting the hang of it.";
  if (level >= 30) return "Developing. Building real foundations.";
  if (level >= 20) return "Beginner. Learning the basics.";
  if (level >= 10) return "Novice. Just getting started.";
  return "Fresh. Barely scratched the surface.";
}

export interface Skill {
  name: string;
  hours: number;
  level: number;
  icon?: string;
}

export interface SkillCategory {
  title: string;
  skills: Skill[];
}

function makeSkill(name: string, hours: number, icon?: string): Skill {
  return { name, hours, level: levelFromHours(hours), ...(icon ? { icon } : {}) };
}

export const spokenLanguages: SkillCategory = {
  title: "Spoken Languages",
  skills: [
    makeSkill("Dutch", 55662, "/assets/pixel-art/flags/netherlands.png"),
    makeSkill("English", 37595, "/assets/pixel-art/flags/australia.png"),
    makeSkill("German", 67, "/assets/pixel-art/flags/germany.png"),
    makeSkill("Russian", 40, "/assets/pixel-art/flags/russia.png"),
    makeSkill("Japanese", 15, "/assets/pixel-art/flags/japan.png"),
    makeSkill("Spanish", 10, "/assets/pixel-art/flags/spain.png"),
    makeSkill("French", 5, "/assets/pixel-art/flags/france.png"),
    makeSkill("Korean", 2, "/assets/pixel-art/flags/korea.png"),
    makeSkill("Portuguese (BR)", 0.25, "/assets/pixel-art/flags/brazil.png"),
  ],
};

export const programmingLanguages: SkillCategory = {
  title: "Programming Languages",
  skills: [
    makeSkill("HTML", 23000, "/assets/pixel-art/lang-icons/html.png"),
    makeSkill("CSS", 20000, "/assets/pixel-art/lang-icons/css.png"),
    makeSkill("JavaScript", 16425, "/assets/pixel-art/lang-icons/javascript.png"),
    makeSkill("TypeScript", 9855),
    makeSkill("Node.js", 840),
    makeSkill("PHP", 840),
    makeSkill("Laravel", 606),
    makeSkill("Svelte", 450),
    makeSkill("Rust", 90),
    makeSkill("C#", 30, "/assets/pixel-art/lang-icons/csharp.png"),
    makeSkill("SQL", 25),
  ],
};

export const allCategories = [spokenLanguages, programmingLanguages];
