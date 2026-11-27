// SPOILERS: this module holds the answer and the ending.
// The app only imports it to check an accusation and to show the
// ending after a correct one. See docs/SOLUTION.md for the full walkthrough.

const CULPRIT = 'corin ashdown';
// People's names are stored in Latin script, but a Mongolian player may
// reasonably type the Cyrillic spelling, so accept the common ones too.
const CULPRIT_ALIASES = new Set([CULPRIT, 'корин эшдаун', 'корин ашдаун', 'корин эшдоун']);
const VICTIM = 'imogen varga';

/** Lower-cases, trims, collapses spaces and drops a leading title like "Dr." or "Доктор". */
export function normalizeName(input) {
  return String(input ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(dr|doctor|mr|mrs|ms|mx|prof|professor|доктор|др|профессор|проф)\.?\s+/u, '')
    .trim();
}

// Gentle nudges for the most likely wrong answers. They point at evidence
// rather than saying who is guilty.
const NUDGES = {
  en: {
    [VICTIM]: 'That is the victim. Read the crime report again for who was involved.',
    'tomas reyes': 'The custodian found the body and only badged into the West Dome at 00:35, well after the time of death.',
    'priya raman': 'Priya heard the argument from the corridor. Her badge puts her on the Roof Deck by 23:44.',
    'priya desai': 'Wrong Priya. Check her interview; she went home at 21:00.',
    'ezra lindqvist': 'Ezra was inside the West Dome, but he wears a blue volunteer lanyard and had no long case checked out.',
    'felix ward': 'Felix still had a long hard case, but his badge says he was on the Roof Deck from 23:35.',
    'noor haddad': 'Noor had a long hard case, but she is a volunteer and was on the Roof Deck all night.',
    'rafael moncada': 'Rafael was in the West Dome, but he left at 23:36 and returned his case at 23:19, before the argument.',
    'hattie kowalczyk': 'Hattie left the West Dome at 23:24, before the argument. Her tool case was small, too.',
    'lena sato': 'Lena fits the motive on paper, but her badge has her on the Roof Deck from 23:43 and she borrowed no long case.',
    'ottoline pike': 'The department chair badged out of the building at 22:20.',
  },
  mn: {
    [VICTIM]: 'Энэ бол хохирогч. Хэрэгт хэн холбогдсоныг гэмт хэргийн мэдээллээс дахин уншаарай.',
    'tomas reyes': 'Үйлчлэгч цогцсыг олсон бөгөөд Баруун бөмбөгөрт зөвхөн 00:35-д, нас барсан цагаас нэлээд хойно картаараа орсон.',
    'priya raman': 'Priya маргааныг коридороос сонссон. Картын бүртгэлээр тэр 23:44 гэхэд дээврийн тавцан дээр байсан.',
    'priya desai': 'Өөр Priya байна. Түүний мэдүүлгийг шалгаарай; тэр 21:00-д гэртээ харьсан.',
    'ezra lindqvist': 'Ezra Баруун бөмбөгөр дотор байсан ч цэнхэр сайн дурын оосор зүүдэг бөгөөд урт хайрцагтай юм аваагүй.',
    'felix ward': 'Felix-ийн гарт урт хатуу хайрцаг байсан ч картын бүртгэлээр тэр 23:35-аас дээврийн тавцан дээр байсан.',
    'noor haddad': 'Noor урт хатуу хайрцагтай байсан ч сайн дурын ажилтан бөгөөд шөнөжин дээврийн тавцан дээр байсан.',
    'rafael moncada': 'Rafael Баруун бөмбөгөрт байсан ч 23:36-д гарсан, хайрцгаа 23:19-д буюу маргаанаас өмнө буцааж өгсөн.',
    'hattie kowalczyk': 'Hattie маргааны өмнө, 23:24-д Баруун бөмбөгөрөөс гарсан. Түүний багажны хайрцаг ч жижиг байсан.',
    'lena sato': 'Сэдлийн хувьд Lena тохирох мэт боловч картын бүртгэлээр 23:43-аас дээврийн тавцан дээр байсан, урт хайрцагтай юм аваагүй.',
    'ottoline pike': 'Тэнхимийн эрхлэгч 22:20-д байрнаас картаараа гарсан.',
  },
};

const VERDICT_TEXT = {
  en: {
    empty: 'Write a name first.',
    correct: 'Case closed.',
    notQuite: 'Not quite.',
    unknown: 'Nobody by that name is in the people table. Check the spelling with a quick query.',
    wrong: 'The evidence does not put that person in the West Dome with a long case at the right time. Keep digging.',
  },
  mn: {
    empty: 'Эхлээд нэр бичнэ үү.',
    correct: 'Хэрэг илэрлээ.',
    notQuite: 'Арай биш.',
    unknown: 'people хүснэгтэд ийм нэртэй хүн алга. Богинохон асуулгаар нэрийн бичлэгийг шалгаарай (нэрс латин үсгээр).',
    wrong: 'Нотлох баримт тэр хүнийг зөв цагт урт хайрцагтай Баруун бөмбөгөрт байсныг харуулахгүй байна. Үргэлжлүүлэн мөрдөөрэй.',
  },
};

/**
 * Decides the outcome of an accusation.
 * personExists is the result of a real lookup in the people table.
 */
export function judgeAccusation(input, personExists, lang = 'en') {
  const text = VERDICT_TEXT[lang] ?? VERDICT_TEXT.en;
  const nudges = NUDGES[lang] ?? NUDGES.en;
  const name = normalizeName(input);
  if (!name) return { verdict: 'empty', message: text.empty };
  if (CULPRIT_ALIASES.has(name)) return { verdict: 'correct', message: text.correct };
  if (nudges[name]) return { verdict: 'wrong', message: `${text.notQuite} ${nudges[name]}` };
  if (!personExists) return { verdict: 'unknown', message: text.unknown };
  return { verdict: 'wrong', message: text.wrong };
}

export const ENDINGS = {
  en: {
    culprit: 'Corin Ashdown',
    headline: 'Corin Ashdown killed Dr. Imogen Varga.',
    motive:
      "Corin, a postdoc in Varga's group, had submitted her C/2026 K3 comet spectra to a journal under his own name. Varga discovered it, showed the department chair, and planned to file a misconduct complaint on Monday. That would have ended his career, and the only proof was the raw data on the external drive she carried everywhere.",
    chain: [
      ['The report', 'Varga died in the West Dome between 23:45 and 00:05. Her external drive was missing.'],
      ['The witnesses', 'Priya heard a man tell Varga the paper was "already submitted" around 23:40. Ezra saw a red-lanyard figure with a long black case on the catwalk at 23:44 to 23:47. Tomas saw the same figure leave at 23:51.'],
      ['Badge logs', 'Corin entered the West Dome three times that night, and the last visit ran from 23:38 to 23:51, covering the argument and the time of death.'],
      ['Loan records', 'Corin borrowed a portable spectrograph in a long hard case at 22:55 and did not return it until 07:58 the next morning.'],
      ['Staff only', 'His department is Astrophysics, so he wore a red staff lanyard. The other long-case holders were a volunteer (Noor) or nowhere near the dome (Felix).'],
      ['The lie', 'Corin told police he went "straight up to the Roof Deck around 23:30" and never went near the West Dome. His badge reached the Roof Deck at 23:57, and he scanned into the meteor watch at 23:58 to build an alibi.'],
      ['The drive', 'The loan desk technician found the foam cut out of the returned spectrograph case: room for a hard drive. The department chair reported the drive missing that morning.'],
    ],
  },
  mn: {
    culprit: 'Corin Ashdown',
    headline: 'Доктор Imogen Varga-г Corin Ashdown хөнөөсөн.',
    motive:
      'Varga-гийн бүлгийн докторын дараах судлаач Corin түүний C/2026 K3 сүүлт одны спектрийг өөрийн нэрээр сэтгүүлд илгээсэн байв. Varga үүнийг илрүүлж, тэнхимийн эрхлэгчид үзүүлээд, даваа гарагт ёс зүйн зөрчлийн гомдол гаргахаар төлөвлөж байсан. Энэ нь Corin-ий карьерыг дуусгах байсан бөгөөд цорын ганц баттай нотолгоо нь Varga-гийн хаа явсан газраа авч явдаг гадаад хатуу дискэнд байсан анхны өгөгдөл байв.',
    chain: [
      ['Мэдээлэл', 'Varga 23:45-аас 00:05-ын хооронд Баруун бөмбөгөрт нас барсан. Түүний гадаад хатуу диск алга болсон.'],
      ['Гэрчүүд', 'Priya 23:40 орчимд нэг эрэгтэй хүн өгүүлэл «аль хэдийн илгээгдсэн» гэж хэлэхийг сонссон. Ezra 23:44-өөс 23:47-ийн хооронд дээд явган гүүр дээр урт хар хайрцагтай, улаан оосортой хүнийг харсан. Tomas тэр хүнийг 23:51-д гарахыг харсан.'],
      ['Картын бүртгэл', 'Corin тэр шөнө Баруун бөмбөгөрт гурван удаа орсон. Сүүлийнх нь 23:38-аас 23:51 хүртэл үргэлжилж, маргаан болон нас барсан цагийг бүрэн хамарсан.'],
      ['Олгосон тоног төхөөрөмж', 'Corin 22:55-д урт хатуу хайрцагтай зөөврийн спектрограф авч, маргааш өглөө нь 07:58-д л буцааж өгсөн.'],
      ['Зөвхөн ажилтан', 'Тэр Астрофизикийн тэнхимийнх тул улаан оосор зүүдэг. Урт хайрцагтай бусад хүмүүсийн нэг нь сайн дурын ажилтан (Noor), нөгөө нь бөмбөгөрийн ойролцоо ч байгаагүй (Felix).'],
      ['Худал мэдүүлэг', 'Corin цагдаад «арван нэгэн хагас орчим шууд дээврийн тавцан руу гарсан», Баруун бөмбөгөрийн ойролцоо ч очоогүй гэж хэлсэн. Гэтэл картын бүртгэлээр тэр дээврийн тавцанд 23:57-д хүрч, алиби бүрдүүлэх гэж 23:58-д солир ажиглалтад бүртгүүлсэн.'],
      ['Хатуу диск', 'Олгох цэгийн техникч буцаж ирсэн спектрографын хайрцагны хөөсөн доторлогоог хайчилсан байхыг олсон: хатуу диск багтах зай. Тэнхимийн эрхлэгч тэр өглөө дискийг алга болсон гэж мэдэгдсэн.'],
    ],
  },
};

export function getEnding(lang) {
  return ENDINGS[lang] ?? ENDINGS.en;
}
