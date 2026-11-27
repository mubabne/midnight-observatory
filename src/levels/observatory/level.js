// Level 2 · Midnight at the Observatory: the original case, in English and Mongolian.
// The case text lives in case.js and the answer in solution.js (spoilers).
import { CASES } from './case.js';
import { judgeAccusation, getEnding } from './solution.js';

const ui = {
  en: {
    title: 'Midnight at the Observatory',
    difficulty: 'Intermediate',
    eyebrow: 'Level 2 · Intermediate · Case file 26-1017 · Halvorsen Ridge',
    stamp: 'Homicide · Active',
    summary:
      'A researcher is found dead in an observatory dome. Follow witnesses through six linked tables and learn to connect them with JOIN.',
    skills: ['JOIN', 'BETWEEN', 'LIKE', 'DISTINCT', 'ORDER BY', 'GROUP BY (bonus)'],
    accuseHeading: 'Name the killer',
    accuseHelp: "Write the person's full name as it appears in `people`. Wrong guesses cost nothing.",
    solvedText: 'Case closed. You named the killer.',
    notesPlaceholder: 'e.g. Custodian saw someone leave at 23:51 with a long hard case…',
    bonusButton: 'Show the bonus lead (GROUP BY)',
  },
  mn: {
    title: 'Ажиглалтын төвийн шөнө дунд',
    difficulty: 'Дунд шат',
    eyebrow: '2-р түвшин · Дунд шат · Хэргийн дугаар 26-1017 · Халворсен Ридж',
    stamp: 'Аллага · Шалгагдаж буй',
    summary:
      'Ажиглалтын төвийн бөмбөгөр дотроос судлаач нас барсан байдалтай олдов. Холбоотой зургаан хүснэгтээр гэрчүүдийг мөшгиж, JOIN ашиглаж сурна.',
    skills: ['JOIN', 'BETWEEN', 'LIKE', 'DISTINCT', 'ORDER BY', 'GROUP BY (нэмэлт)'],
    accuseHeading: 'Алуурчныг нэрлэх',
    accuseHelp: '`people` хүснэгтэд байгаа бүтэн нэрийг латин үсгээр бичнэ үү. Буруу таавал ямар ч хохиролгүй.',
    solvedText: 'Хэрэг илэрлээ. Та алуурчныг зөв нэрлэлээ.',
    notesPlaceholder: 'Жишээ нь: Үйлчлэгч 23:51-д урт хатуу хайрцагтай хүн гарахыг харсан…',
    bonusButton: 'Нэмэлт сэжүүрийг харах (GROUP BY)',
  },
};

export default {
  id: 'observatory',
  number: 2,
  kind: 'case',
  writable: false,
  database: { seed: 'seed.sql', overlays: { mn: ['i18n/mn.sql'] } },
  personLookup: 'SELECT name FROM people WHERE lower(trim(name)) = :name LIMIT 1;',
  content: {
    en: { ...ui.en, ...CASES.en },
    mn: { ...ui.mn, ...CASES.mn },
  },
  judge: judgeAccusation,
  ending: getEnding,
};
