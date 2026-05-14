// All 48 World Cup 2026 teams with their flag emojis and Hebrew names
// Includes group assignments for the group stage

export const TEAMS = {
  // Group A
  'Mexico': { he: 'מקסיקו', flag: '🇲🇽', group: 'A' },
  'South Africa': { he: 'דרום אפריקה', flag: '🇿🇦', group: 'A' },
  'South Korea': { he: 'דרום קוריאה', flag: '🇰🇷', group: 'A' },
  'Czechia': { he: 'צ׳כיה', flag: '🇨🇿', group: 'A' },
  // Group B
  'Canada': { he: 'קנדה', flag: '🇨🇦', group: 'B' },
  'Bosnia and Herzegovina': { he: 'בוסניה והרצגובינה', flag: '🇧🇦', group: 'B' },
  'Qatar': { he: 'קטאר', flag: '🇶🇦', group: 'B' },
  'Switzerland': { he: 'שווייץ', flag: '🇨🇭', group: 'B' },
  // Group C
  'Brazil': { he: 'ברזיל', flag: '🇧🇷', group: 'C' },
  'Morocco': { he: 'מרוקו', flag: '🇲🇦', group: 'C' },
  'Haiti': { he: 'האיטי', flag: '🇭🇹', group: 'C' },
  'Scotland': { he: 'סקוטלנד', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'C' },
  // Group D
  'USA': { he: 'ארה״ב', flag: '🇺🇸', group: 'D' },
  'Paraguay': { he: 'פרגוואי', flag: '🇵🇾', group: 'D' },
  'Australia': { he: 'אוסטרליה', flag: '🇦🇺', group: 'D' },
  'Türkiye': { he: 'טורקיה', flag: '🇹🇷', group: 'D' },
  // Group E
  'Germany': { he: 'גרמניה', flag: '🇩🇪', group: 'E' },
  'Curaçao': { he: 'קוראסאו', flag: '🇨🇼', group: 'E' },
  'Ivory Coast': { he: 'חוף השנהב', flag: '🇨🇮', group: 'E' },
  'Ecuador': { he: 'אקוודור', flag: '🇪🇨', group: 'E' },
  // Group F
  'Netherlands': { he: 'הולנד', flag: '🇳🇱', group: 'F' },
  'Japan': { he: 'יפן', flag: '🇯🇵', group: 'F' },
  'Sweden': { he: 'שוודיה', flag: '🇸🇪', group: 'F' },
  'Tunisia': { he: 'תוניסיה', flag: '🇹🇳', group: 'F' },
  // Group G
  'Belgium': { he: 'בלגיה', flag: '🇧🇪', group: 'G' },
  'Egypt': { he: 'מצרים', flag: '🇪🇬', group: 'G' },
  'Iran': { he: 'איראן', flag: '🇮🇷', group: 'G' },
  'New Zealand': { he: 'ניו זילנד', flag: '🇳🇿', group: 'G' },
  // Group H
  'Spain': { he: 'ספרד', flag: '🇪🇸', group: 'H' },
  'Cape Verde': { he: 'כף ורדה', flag: '🇨🇻', group: 'H' },
  'Saudi Arabia': { he: 'ערב הסעודית', flag: '🇸🇦', group: 'H' },
  'Uruguay': { he: 'אורוגוואי', flag: '🇺🇾', group: 'H' },
  // Group I
  'France': { he: 'צרפת', flag: '🇫🇷', group: 'I' },
  'Senegal': { he: 'סנגל', flag: '🇸🇳', group: 'I' },
  'Iraq': { he: 'עיראק', flag: '🇮🇶', group: 'I' },
  'Norway': { he: 'נורווגיה', flag: '🇳🇴', group: 'I' },
  // Group J
  'Argentina': { he: 'ארגנטינה', flag: '🇦🇷', group: 'J' },
  'Algeria': { he: 'אלג׳יריה', flag: '🇩🇿', group: 'J' },
  'Austria': { he: 'אוסטריה', flag: '🇦🇹', group: 'J' },
  'Jordan': { he: 'ירדן', flag: '🇯🇴', group: 'J' },
  // Group K
  'Portugal': { he: 'פורטוגל', flag: '🇵🇹', group: 'K' },
  'DR Congo': { he: 'קונגו', flag: '🇨🇩', group: 'K' },
  'Uzbekistan': { he: 'אוזבקיסטן', flag: '🇺🇿', group: 'K' },
  'Colombia': { he: 'קולומביה', flag: '🇨🇴', group: 'K' },
  // Group L
  'England': { he: 'אנגליה', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'L' },
  'Croatia': { he: 'קרואטיה', flag: '🇭🇷', group: 'L' },
  'Ghana': { he: 'גאנה', flag: '🇬🇭', group: 'L' },
  'Panama': { he: 'פנמה', flag: '🇵🇦', group: 'L' },
};

// Helper to get team info
export function getTeam(name) {
  return TEAMS[name] || { he: name, flag: '🏳️', group: '' };
}

// All teams as array for dropdowns, sorted by Hebrew name
export const TEAMS_LIST = Object.entries(TEAMS)
  .map(([name, data]) => ({ name, ...data }))
  .sort((a, b) => a.he.localeCompare(b.he, 'he'));
