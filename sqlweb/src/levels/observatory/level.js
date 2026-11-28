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
    title: 'Одон орны төвд шөнө дунд',
    difficulty: 'Дунд шат',
    eyebrow: '2-р түвшин · Дунд шат · Хэргийн дугаар 26-1017 · Халворсен Ридж',
    stamp: 'Аллага · Мөрдөн шалгаж байна',
    summary:
      'Одон орны төвийн бөмбөгөр танхимаас нэгэн судлаач нас барсан байдалтай олджээ. Холбоотой зургаан хүснэгтээс гэрчүүдийн мэдүүлэг, бусад баримтыг хайж, JOIN ашиглан нэгтгэж сураарай.',
    skills: ['JOIN', 'BETWEEN', 'LIKE', 'DISTINCT', 'ORDER BY', 'GROUP BY (нэмэлт)'],
    accuseHeading: 'Алуурчныг нэрлэх',
    accuseHelp: 'Тухайн хүний бүтэн нэрийг `people` хүснэгтэд бичсэнээр нь оруулаарай. Нэрс латин үсгээр байгаа. Буруу нэр оруулсан ч торгуульгүй.',
    solvedText: 'Хэрэг илэрлээ. Та алуурчныг зөв нэрлэлээ.',
    notesPlaceholder: 'Жишээ нь: Үйлчлэгч 23:51-д урт, хатуу хайрцаг барьсан хүн гарч ирэхийг харжээ…',
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
