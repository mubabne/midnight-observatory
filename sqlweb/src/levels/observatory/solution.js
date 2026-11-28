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
    [VICTIM]: 'Энэ хүн бол хохирогч. Цагдаагийн бүртгэл дэх хэргийн мэдээллийг дахин уншиж, гэрчүүдийг тодруулаарай.',
    'tomas reyes': 'Үйлчлэгч цогцсыг олсон хүн. Тэр Баруун бөмбөгөр танхимд 00:35 цагт л картаараа орсон нь хохирогчийн нас барсан цагаас нэлээд хойно байна.',
    'priya raman': 'Priya коридорт явж байхдаа маргааныг сонссон. Картын бүртгэлээр тэр 23:44 цаг гэхэд дээврийн тавцан дээр очсон байна.',
    'priya desai': 'Та өөр Priya-г сонгосон байна. Мэдүүлгийг нь уншаарай. Тэр 21:00 цагт гэртээ харьсан.',
    'ezra lindqvist': 'Ezra Баруун бөмбөгөр танхимд байсан. Гэхдээ тэр сайн дурын ажилтны цэнхэр оосор зүүдэг бөгөөд урт хайрцагтай тоног төхөөрөмж зээлээгүй.',
    'felix ward': 'Felix урт хатуу хайрцагтай тоног төхөөрөмжөө буцааж өгөөгүй байсан. Гэхдээ картын бүртгэлээр тэр 23:35 цагаас дээврийн тавцан дээр байжээ.',
    'noor haddad': 'Noor урт хатуу хайрцагтай байсан ч сайн дурын ажилтан. Мөн тэр шөнөжин дээврийн тавцан дээр байсан.',
    'rafael moncada': 'Rafael Баруун бөмбөгөр танхимаас 23:36 цагт гарсан. Харин хайрцагтай тоног төхөөрөмжөө 23:19 цагт буюу маргаан болохоос өмнө буцааж өгсөн.',
    'hattie kowalczyk': 'Hattie маргаан болохоос өмнө буюу 23:24 цагт Баруун бөмбөгөр танхимаас гарсан. Түүнчлэн түүний багажны хайрцаг жижиг байсан.',
    'lena sato': 'Lena-д гэмт хэрэг үйлдэх сэдэл байсан байж болно. Гэхдээ картын бүртгэлээр тэр 23:43 цагаас дээврийн тавцан дээр байсан бөгөөд урт хайрцагтай тоног төхөөрөмж зээлээгүй.',
    'ottoline pike': 'Тэнхимийн эрхлэгч 22:20 цагт картаа уншуулаад байрнаас гарсан байна.',
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
    notQuite: 'Энэ хүн биш байна.',
    unknown: 'people хүснэгтэд ийм нэртэй хүн алга. Асуулга ажиллуулж нэрийг нь шалгаарай. Нэрс латин үсгээр бичигдсэн байгаа.',
    wrong: 'Тэр хүн хэрэг болсон үед урт хайрцагтайгаа Баруун бөмбөгөр танхимд байсан нь нотлогдохгүй байна. Бүртгэлүүдээ үргэлжлүүлэн шалгаарай.',
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
    headline: 'Corin Ashdown доктор Imogen Varga-г хөнөөсөн.',
    motive:
      'Varga-гийн багийн докторын дараах судлаач Corin түүний C/2026 K3 сүүлт одны спектрийн өгөгдлийг өөрийн нэрээр сэтгүүлд илгээжээ. Varga үүнийг олж мэдээд тэнхимийн эрхлэгчид үзүүлсэн. Тэр даваа гарагт судалгааны ёс зүйн зөрчлийн талаар гомдол гаргах гэж байв. Гомдол гарвал Corin-ий судлаачийн замнал дуусах байлаа. Хулгайг нотлох цорын ганц баримт нь Varga-гийн үргэлж авч явдаг гадаад хатуу дискэн дэх анхны өгөгдөл байсан.',
    chain: [
      ['Хэргийн бүртгэл', 'Varga Баруун бөмбөгөр танхимд 23:45-аас 00:05-ын хооронд нас баржээ. Түүний гадаад хатуу диск алга болсон байв.'],
      ['Гэрчүүдийн мэдүүлэг', 'Priya 23:40 орчимд нэг эрэгтэй хүн Varga-д өгүүлэл «аль хэдийн илгээгдсэн» гэж хэлэхийг сонссон. Ezra 23:44-өөс 23:47 цагийн хооронд дээд талын явган тавцан дээр урт хар хайрцагтай, улаан оосортой хүн харсан. Tomas тэр хүнийг 23:51 цагт гарч ирэхийг харжээ.'],
      ['Картын бүртгэл', 'Corin тэр шөнө Баруун бөмбөгөр танхимд гурван удаа орсон. Хамгийн сүүлд 23:38 цагт орж, 23:51 цагт гарсан нь маргаан болсон болон хохирогч нас барсан гэх хугацаатай давхцаж байна.'],
      ['Тоног төхөөрөмжийн зээлийн бүртгэл', 'Corin 22:55 цагт урт хатуу хайрцагтай зөөврийн спектрограф зээлж авсан. Түүнийгээ маргааш өглөөний 07:58 цаг хүртэл буцааж өгөөгүй.'],
      ['Улаан оосрын учир', 'Corin Астрофизикийн тэнхимийн үндсэн ажилтан тул улаан оосор зүүдэг. Тэр үед урт хайрцагтай байсан бусад хүнээс Noor нь сайн дурын ажилтан, харин Felix нь бөмбөгөр танхимын ойролцоо байгаагүй.'],
      ['Худал мэдүүлэг', 'Corin цагдаад оройн арван нэгэн цаг хагасын орчимд шууд дээврийн тавцан руу гарсан, Баруун бөмбөгөр танхимын ойролцоо ч очоогүй гэж мэдүүлсэн. Гэтэл картын бүртгэлээр тэр дээврийн тавцанд 23:57 цагт л очжээ. Өөр газар байсан мэт харагдуулахын тулд 23:58 цагт солир ажиглах арга хэмжээнд бүртгүүлсэн байна.'],
      ['Алга болсон хатуу диск', 'Техникч буцааж өгсөн спектрографын хайрцагны хөөсөн доторлогоог хайчилж, хатуу диск багтах зай гаргасныг олж харсан. Тэр өглөө тэнхимийн эрхлэгч диск алга болсныг мэдэгдсэн.'],
    ],
  },
};

export function getEnding(lang) {
  return ENDINGS[lang] ?? ENDINGS.en;
}
