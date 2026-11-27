// SPOILERS: the culprits of the two case levels and the nudges for likely
// wrong answers. Ported from the web game's observatory/solution.js and
// coldcase/solution.js. The endings themselves live in levels.json.

class Verdict {
  const Verdict(this.kind, this.message);

  /// 'empty', 'correct', 'wrong' or 'unknown'.
  final String kind;
  final String message;
  bool get correct => kind == 'correct';
}

/// Lower-cases, trims, collapses spaces and drops a leading title like "Dr." or "Доктор".
String normalizeName(String? input) {
  var s = (input ?? '').toLowerCase().replaceAll(RegExp('[’\']'), "'").replaceAll(RegExp(r'\s+'), ' ').trim();
  s = s.replaceFirst(
    RegExp(r'^(dr|doctor|mr|mrs|ms|mx|prof|professor|доктор|др|профессор|проф)\.?\s+', unicode: true),
    '',
  );
  return s.trim();
}

class _Case {
  const _Case({required this.culprits, required this.nudges, required this.text});
  final Set<String> culprits;
  final Map<String, Map<String, String>> nudges; // lang -> name -> nudge
  final Map<String, Map<String, String>> text; // lang -> key -> text
}

const _observatory = _Case(
  // People's names are stored in Latin script, but a Mongolian player may
  // reasonably type the Cyrillic spelling, so accept the common ones too.
  culprits: {'corin ashdown', 'корин эшдаун', 'корин ашдаун', 'корин эшдоун'},
  nudges: {
    'en': {
      'imogen varga': 'That is the victim. Read the crime report again for who was involved.',
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
    'mn': {
      'imogen varga': 'Энэ бол хохирогч. Хэрэгт хэн холбогдсоныг гэмт хэргийн мэдээллээс дахин уншаарай.',
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
  },
  text: {
    'en': {
      'empty': 'Write a name first.',
      'correct': 'Case closed.',
      'notQuite': 'Not quite.',
      'unknown': 'Nobody by that name is in the people table. Check the spelling with a quick query.',
      'wrong': 'The evidence does not put that person in the West Dome with a long case at the right time. Keep digging.',
    },
    'mn': {
      'empty': 'Эхлээд нэр бичнэ үү.',
      'correct': 'Хэрэг илэрлээ.',
      'notQuite': 'Арай биш.',
      'unknown': 'people хүснэгтэд ийм нэртэй хүн алга. Богинохон асуулгаар нэрийн бичлэгийг шалгаарай (нэрс латин үсгээр).',
      'wrong': 'Нотлох баримт тэр хүнийг зөв цагт урт хайрцагтай Баруун бөмбөгөрт байсныг харуулахгүй байна. Үргэлжлүүлэн мөрдөөрэй.',
    },
  },
);

const _patient = 'That is one of the five patients.';
const _coldcase = _Case(
  culprits: {'margo ellery'},
  nudges: {
    'en': {
      'dov pereira':
          'Dov was working every time a poisoned drink was ordered, but he was only on the drinks station for two of those five orders.',
      'ines calder': 'Ines was not working on 8 September, when Bernard Lusk ordered his tea.',
      'pip langford': 'Pip was on shift for only one of the five poisoned orders.',
      'sunny okonkwo': 'Sunny was on shift for only two of the five poisoned orders, and never on drinks.',
      'theo brandt':
          'Theo works at Copperline Coffee, and Fern Ostrova never ordered there in the 48 hours before she fell ill.',
      'hazel kim':
          'Hazel works at Copperline Coffee, and Fern Ostrova never ordered there in the 48 hours before she fell ill.',
      'agnes whitford': _patient,
      'bernard lusk': _patient,
      'celia moon': _patient,
      'desmond achebe': _patient,
      'fern ostrova': _patient,
      'beatrix coyle': 'Beatrix is a customer with nothing to do with the stall behind the counter. Read her review.',
      'hugo varela': 'Hugo ended up in hospital with an allergic reaction, not thallium. He is a customer, not staff.',
    },
  },
  text: {
    'en': {
      'empty': 'Write a name first.',
      'correct': 'Case closed.',
      'notQuite': 'Not quite.',
      'unknown': 'Nobody by that name is in staff or customers. Check the spelling with a quick query.',
      'wrong': 'The station log does not put that person on the drinks station for all five poisoned orders. Keep digging.',
    },
  },
);

const _cases = {'observatory': _observatory, 'coldcase': _coldcase};

/// Decides the outcome of an accusation. [personExists] comes from a real
/// lookup in the level's database.
Verdict judgeAccusation(String levelId, String input, bool personExists, String lang) {
  final c = _cases[levelId]!;
  final text = c.text[lang] ?? c.text['en']!;
  final nudges = c.nudges[lang] ?? c.nudges['en']!;
  final name = normalizeName(input);
  if (name.isEmpty) return Verdict('empty', text['empty']!);
  if (c.culprits.contains(name)) return Verdict('correct', text['correct']!);
  final nudge = nudges[name];
  if (nudge != null) return Verdict('wrong', '${text['notQuite']} $nudge');
  if (!personExists) return Verdict('unknown', text['unknown']!);
  return Verdict('wrong', text['wrong']!);
}
