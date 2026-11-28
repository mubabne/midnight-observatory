// Player-facing case content, per language. Nothing in this file names the culprit.
// Text literals inside hint queries must match the data in that language
// (English seed.sql, or seed.sql + i18n/mn.sql for Mongolian).

const en = {
  startingQuery: `-- Welcome, detective. Press Run (or Ctrl+Enter).
-- This lists every police report filed on the morning of the murder.
SELECT *
FROM crime_reports
WHERE occurred_at LIKE '2026-10-17%'
ORDER BY occurred_at;
`,
  briefing: {
    premise:
      'Friday night, Halvorsen Ridge Observatory held its Autumn Star Party: a fundraising gala in the Main Hall, followed by a meteor watch on the Roof Deck. Shortly after midnight, a researcher was found dead inside the West Dome.',
    objective:
      'Find the police report, track down the witnesses, and follow the records until exactly one person fits all of the evidence. Then name them below.',
    facts: [
      ['Date', 'Early hours of Saturday, 17 October 2026'],
      ['Place', 'Halvorsen Ridge Observatory, West Dome'],
      ['Type', 'murder'],
    ],
    conventions: [
      "Times are local, 24-hour, stored as text like '2026-10-16 23:45'. Comparing them as text sorts correctly, so BETWEEN and < work.",
      'Badge readers log both directions (in and out). Only staff and volunteers carry badges.',
      'Event kiosk check-ins are reliable. Check-outs are optional, so a NULL check-out proves nothing by itself.',
      'Each query runs on a fresh copy of the evidence. You cannot break anything.',
    ],
  },
  tableNotes: {
    people: 'Everyone connected to the case: staff, volunteers and visitors.',
    crime_reports: 'Police reports from around Larkspur Falls.',
    interviews: 'Statements taken after the murder. Join on person_id.',
    access_logs: 'Badge-door scans. Direction is in or out.',
    equipment_loans: 'Loan desk records. returned_at is NULL while an item is still out.',
    event_attendance: 'Kiosk scans for observatory events.',
  },
  // Revealed one at a time. The idea comes first; the near-solution query comes last.
  hints: [
    {
      title: 'Read the report closely',
      body:
        "The starting query finds three reports from 17 October. Narrow it to the murder with WHERE type = 'murder', then read the description. It describes two witnesses without giving full names.",
    },
    {
      title: 'Find the witnesses, then hear them out',
      body:
        'Search people with LIKE: one witness is the night custodian, the other a volunteer docent named Priya. Then JOIN interviews to people ON interviews.person_id = people.id to read what they saw.',
      sql: `SELECT p.name, p.occupation, i.transcript
FROM interviews AS i
JOIN people AS p ON p.id = i.person_id
WHERE p.occupation LIKE '%custodian%'
   OR p.name LIKE 'Priya%';`,
    },
    {
      title: 'Turn the sighting into filters',
      body:
        'The custodian gives you three filters. (1) Who badged into the West Dome around the argument and the time of death? (2) Who had a long hard case checked out at 23:51? (3) A red lanyard means staff, so not the Volunteer Program and not a Visitor. Query access_logs and equipment_loans separately and compare.',
      sql: `SELECT p.name, p.department, a.direction, a.accessed_at
FROM access_logs AS a
JOIN people AS p ON p.id = a.person_id
WHERE a.location = 'West Dome'
  AND a.accessed_at BETWEEN '2026-10-16 23:00' AND '2026-10-17 00:40'
ORDER BY a.accessed_at;`,
    },
    {
      title: 'Combine the evidence',
      body:
        "Join the loan records to the badge logs so that only someone matching every detail is left. Then corroborate: read that person's own interview, and check what the department chair and the loan desk technician told police.",
      sql: `SELECT DISTINCT p.name, p.department, l.item_name, l.returned_at
FROM equipment_loans AS l
JOIN people AS p      ON p.id = l.person_id
JOIN access_logs AS a ON a.person_id = p.id
WHERE l.item_name LIKE '%long hard case%'
  AND l.borrowed_at <= '2026-10-16 23:51'
  AND (l.returned_at IS NULL OR l.returned_at > '2026-10-16 23:51')
  AND a.location = 'West Dome'
  AND a.accessed_at BETWEEN '2026-10-16 23:40' AND '2026-10-16 23:55'
  AND p.department NOT IN ('Volunteer Program', 'Visitor');`,
    },
  ],
  bonusLead: {
    title: 'Bonus lead: the door that kept beeping',
    body:
      'The custodian thought the same badge kept coming back to the West Dome. Can you count West Dome entries per person on the night of the 16th with GROUP BY, and keep only people who entered at least three times with HAVING?',
  },
};

const mn = {
  startingQuery: `-- Тавтай морил, мөрдөгч өө. «Асуулга ажиллуулах» товчийг эсвэл Ctrl+Enter дараарай.
-- Энэ асуулга аллага болсон өдрийн цагдаагийн бүх бүртгэлийг харуулна.
SELECT *
FROM crime_reports
WHERE occurred_at LIKE '2026-10-17%'
ORDER BY occurred_at;
`,
  briefing: {
    premise:
      'Баасан гарагийн орой Халворсен Риджийн одон орны төвд «Намрын одны үдэшлэг» болжээ. Эхлээд Их танхимд хандив цуглуулах үдэшлэг зохион байгуулж, дараа нь дээврийн тавцан дээр солир ажигласан байна. Шөнө дундаас хойш удалгүй Баруун бөмбөгөр танхимаас нэгэн судлаач нас барсан байдалтай олджээ.',
    objective:
      'Цагдаагийн бүртгэлээс энэ хэргийн мэдээллийг олж, гэрчүүдийг тодруулаарай. Дараа нь бусад бүртгэлтэй тулгаж, бүх нотлох баримтад тохирох ганц хүнийг олоорой. Олсон хүнийхээ нэрийг доор бичээрэй.',
    facts: [
      ['Огноо', '2026 оны 10-р сарын 17-ны бямба гараг, шөнө дундаас хойш'],
      ['Газар', 'Халворсен Риджийн одон орны төв, Баруун бөмбөгөр танхим'],
      ['Төрөл', 'аллага'],
    ],
    conventions: [
      'Хүснэгт, баганын нэрийг англиар хэвээр үлдээсэн. Текстэн утгууд монголоор, хүмүүсийн нэр латин үсгээр бичигдсэн.',
      "Огноо, цагийг орон нутгийн цагаар, 24 цагийн хэлбэрээр хадгалсан. Жишээ нь: '2026-10-16 23:45'. Энэ хэлбэрийн текст цагийн дарааллаар зөв эрэмбэлэгддэг тул BETWEEN, < зэрэг үйлдэл ашиглаж болно.",
      "Хаалганы карт уншигч орох, гарах бүрд бүртгэл хөтөлдөг. direction баганын утга нь 'орсон' эсвэл 'гарсан' байна. Зөвхөн ажилтнууд, сайн дурынхан нэвтрэх карттай.",
      'Арга хэмжээнд ирсэн цагийг киоскт заавал бүртгүүлдэг тул энэ бүртгэлд найдаж болно. Харин гарахдаа бүртгүүлэх албагүй. Тиймээс checked_out_at нь NULL байлаа гээд тухайн хүн тэнд үлдсэн гэж дүгнэж болохгүй.',
      'Энэ тоглоомд LIKE том, жижиг үсгийг ялгахгүй. Кирилл үсгээр хайхад ч адилхан.',
      'Асуулга бүр нотлох баримтын шинэ хуулбар дээр ажиллана. Тиймээс эх баримтыг өөрчилж, устгахгүй.',
    ],
  },
  tableNotes: {
    people: 'Хэрэгт холбогдох бүх хүн: ажилтнууд, сайн дурынхан, зочид.',
    crime_reports: 'Ларкспур Фоллс орчимд гарсан гэмт хэргийн цагдаагийн бүртгэл.',
    interviews: 'Аллагын дараа авсан мэдүүлгүүд. person_id баганаар people хүснэгттэй холбоно.',
    access_logs: "Картаар хаалгаар орсон, гарсан бүртгэл. direction нь 'орсон' эсвэл 'гарсан' гэсэн утгатай.",
    equipment_loans: 'Тоног төхөөрөмж зээлээр олгосон бүртгэл. Буцааж өгөөгүй бол returned_at нь NULL байна.',
    event_attendance: 'Арга хэмжээнд ирсэн, гарснаа киоскт бүртгүүлсэн мэдээлэл.',
  },
  hints: [
    {
      title: 'Хэргийн мэдээллийг анхааралтай уншаарай',
      body:
        "Эхлэлийн асуулга 10-р сарын 17-ны гурван бүртгэлийг харуулна. WHERE type = 'аллага' нөхцөлөөр аллагын бүртгэлийг ялгаж, description баганын мэдээллийг уншаарай. Тэнд хоёр гэрчийн бүтэн нэрийг хэлэлгүйгээр хэн болохыг нь тайлбарласан байгаа.",
    },
    {
      title: 'Гэрчүүдийг олоод мэдүүлгийг нь уншаарай',
      body:
        'Нэг гэрч нь шөнийн үйлчлэгч, нөгөө нь Priya нэртэй сайн дурын хөтөч. people хүснэгтээс LIKE ашиглан тэднийг хайгаарай. Дараа нь interviews болон people хүснэгтийг interviews.person_id = people.id нөхцөлөөр JOIN хийж, тэдний мэдүүлгийг уншаарай.',
      sql: `SELECT p.name, p.occupation, i.transcript
FROM interviews AS i
JOIN people AS p ON p.id = i.person_id
WHERE p.occupation LIKE '%үйлчлэгч%'
   OR p.name LIKE 'Priya%';`,
    },
    {
      title: 'Гэрчийн мэдүүлгээс шүүх нөхцөлүүдээ гаргаарай',
      body:
        'Үйлчлэгчийн мэдүүлгээс гурван нөхцөл гаргаж болно. (1) Маргаан болж, хохирогч нас барсан цагийн орчимд хэн Баруун бөмбөгөр танхимд картаараа орсон бэ? (2) 23:51 цагт урт хатуу хайрцагтай тоног төхөөрөмжийг хэн зээлээд, буцааж өгөөгүй байсан бэ? (3) Улаан оосор зүүсэн хүн үндсэн ажилтан тул department нь «Сайн дурын хөтөлбөр» эсвэл «Зочин» байх ёсгүй. access_logs, equipment_loans хүснэгтийг эхлээд тус тусад нь шалгаж, үр дүнг нь харьцуулаарай.',
      sql: `SELECT p.name, p.department, a.direction, a.accessed_at
FROM access_logs AS a
JOIN people AS p ON p.id = a.person_id
WHERE a.location = 'Баруун бөмбөгөр'
  AND a.accessed_at BETWEEN '2026-10-16 23:00' AND '2026-10-17 00:40'
ORDER BY a.accessed_at;`,
    },
    {
      title: 'Нотлох баримтуудаа нэгтгээрэй',
      body:
        'Тоног төхөөрөмжийн зээлийн бүртгэлийг картын бүртгэлтэй JOIN хийж, бүх нөхцөлд тохирох хүнийг олоорой. Дүгнэлтээ бататгахын тулд тэр хүний мэдүүлгийг уншаарай. Мөн тэнхимийн эрхлэгч, тоног төхөөрөмж олгодог техникч хоёрын мэдүүлэгтэй тулгаарай.',
      sql: `SELECT DISTINCT p.name, p.department, l.item_name, l.returned_at
FROM equipment_loans AS l
JOIN people AS p      ON p.id = l.person_id
JOIN access_logs AS a ON a.person_id = p.id
WHERE l.item_name LIKE '%урт хатуу хайрцаг%'
  AND l.borrowed_at <= '2026-10-16 23:51'
  AND (l.returned_at IS NULL OR l.returned_at > '2026-10-16 23:51')
  AND a.location = 'Баруун бөмбөгөр'
  AND a.accessed_at BETWEEN '2026-10-16 23:40' AND '2026-10-16 23:55'
  AND p.department NOT IN ('Сайн дурын хөтөлбөр', 'Зочин');`,
    },
  ],
  bonusLead: {
    title: 'Нэмэлт сэжүүр: дахин дахин дуугарсан карт уншигч',
    body:
      'Үйлчлэгч нэг хүн Баруун бөмбөгөр танхимд дахин дахин ирээд байх шиг санагдсан гэжээ. 10-р сарын 16-ны орой хүн бүр тус танхимд хэдэн удаа орсныг GROUP BY ашиглан тоолоорой. Дараа нь HAVING ашиглаж, гурваас доошгүй удаа орсон хүмүүсийг л үлдээж чадах уу?',
  },
};

export const CASES = { en, mn };
export const LANGUAGES = ['en', 'mn'];

export function getCase(lang) {
  return CASES[lang] ?? CASES.en;
}
