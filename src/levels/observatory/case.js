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
  startingQuery: `-- Тавтай морил, мөрдөгч өө. «Асуулга ажиллуулах» товч (эсвэл Ctrl+Enter) дарна уу.
-- Энэ асуулга аллага болсон өглөө бүртгэгдсэн бүх цагдаагийн мэдээллийг харуулна.
SELECT *
FROM crime_reports
WHERE occurred_at LIKE '2026-10-17%'
ORDER BY occurred_at;
`,
  briefing: {
    premise:
      'Баасан гарагийн орой Халворсен Ридж ажиглалтын төвд «Намрын одны үдэшлэг» болсон: Их танхимд хандивын үдэшлэг, дараа нь дээврийн тавцан дээр солир ажиглалт. Шөнө дундаас хойш удалгүй Баруун бөмбөгөр дотроос нэгэн судлаач нас барсан байдалтай олдов.',
    objective:
      'Цагдаагийн мэдээллийг олж, гэрчүүдийг тодруулаад, бүх нотлох баримтад яг ганц хүн тохирох хүртэл бүртгэлүүдийг мөшгөөрэй. Дараа нь доор түүний нэрийг бичээрэй.',
    facts: [
      ['Огноо', '2026 оны 10-р сарын 17, Бямба гарагийн шөнө'],
      ['Газар', 'Халворсен Ридж ажиглалтын төв, Баруун бөмбөгөр'],
      ['Төрөл', 'аллага'],
    ],
    conventions: [
      'Хүснэгт, баганын нэр SQL-ийн журмаар англиар байгаа ч доторх утгууд монголоор. Хүмүүсийн нэрийг латин үсгээр бичсэн.',
      "Цагийг 24 цагийн форматаар '2026-10-16 23:45' гэх мэтээр текстээр хадгалсан. Текстээр харьцуулахад зөв эрэмбэлэгддэг тул BETWEEN, < зэргийг ашиглаж болно.",
      "Хаалганы карт уншигч орсон, гарсан хоёр чиглэлийг хоёуланг нь бүртгэдэг (direction = 'орсон' эсвэл 'гарсан'). Зөвхөн ажилтан, сайн дурынхан карттай.",
      'Арга хэмжээний киоскийн ирсэн цагийн бүртгэл найдвартай. Гарахдаа бүртгүүлэх нь заавал биш тул checked_out_at нь NULL байх нь дангаараа юуг ч нотлохгүй.',
      'LIKE том, жижиг үсгийг ялгахгүй, кирилл үсэгт ч адилхан ажиллана.',
      'Асуулга бүр нотлох баримтын шинэ хуулбар дээр ажилладаг. Та юуг ч эвдэхгүй.',
    ],
  },
  tableNotes: {
    people: 'Хэрэгт холбогдох бүх хүн: ажилтнууд, сайн дурынхан, зочид.',
    crime_reports: 'Ларкспур Фоллс орчмын цагдаагийн мэдээллүүд.',
    interviews: 'Аллагын дараа авсан мэдүүлгүүд. person_id-аар холбоно.',
    access_logs: "Картаар нэвтэрсэн бүртгэл. direction нь 'орсон' эсвэл 'гарсан'.",
    equipment_loans: 'Тоног төхөөрөмж олгосон бүртгэл. Буцааж өгөөгүй бол returned_at нь NULL.',
    event_attendance: 'Арга хэмжээний киоскийн бүртгэл.',
  },
  hints: [
    {
      title: 'Мэдээллийг анхааралтай унш',
      body:
        "Эхлэлийн асуулга 10-р сарын 17-ны гурван мэдээллийг харуулна. WHERE type = 'аллага' нэмж аллагын мэдээллийг ялгаад тайлбарыг нь уншаарай. Тэнд хоёр гэрчийг бүтэн нэрийг нь хэлэлгүйгээр дурдсан байгаа.",
    },
    {
      title: 'Гэрчүүдийг олоод мэдүүлгийг нь сонс',
      body:
        'people хүснэгтээс LIKE ашиглан хайгаарай: нэг гэрч нь шөнийн үйлчлэгч, нөгөө нь Priya нэртэй сайн дурын хөтөч. Дараа нь interviews-ийг people-тэй interviews.person_id = people.id нөхцөлөөр JOIN хийж, тэд юу харсныг уншаарай.',
      sql: `SELECT p.name, p.occupation, i.transcript
FROM interviews AS i
JOIN people AS p ON p.id = i.person_id
WHERE p.occupation LIKE '%үйлчлэгч%'
   OR p.name LIKE 'Priya%';`,
    },
    {
      title: 'Гэрчийн хэлснийг шүүлтүүр болго',
      body:
        'Үйлчлэгчийн мэдүүлгээс гурван шүүлтүүр гарна. (1) Маргаан болон нас барсан цагийн орчимд хэн Баруун бөмбөгөрт картаараа орсон бэ? (2) 23:51-д хэний гарт урт хатуу хайрцагтай тоног төхөөрөмж байсан бэ? (3) Улаан оосор нь ажилтан гэсэн үг, өөрөөр хэлбэл Сайн дурын хөтөлбөрийнх ч биш, Зочин ч биш. access_logs, equipment_loans хүснэгтүүдийг тус тусад нь шалгаад харьцуулаарай.',
      sql: `SELECT p.name, p.department, a.direction, a.accessed_at
FROM access_logs AS a
JOIN people AS p ON p.id = a.person_id
WHERE a.location = 'Баруун бөмбөгөр'
  AND a.accessed_at BETWEEN '2026-10-16 23:00' AND '2026-10-17 00:40'
ORDER BY a.accessed_at;`,
    },
    {
      title: 'Нотлох баримтуудыг нэгтгэ',
      body:
        'Олгосон тоног төхөөрөмжийн бүртгэлийг картын бүртгэлтэй JOIN хийж, бүх нөхцөлд тохирох хүнийг л үлдээ. Дараа нь нотол: тэр хүний өөрийнх нь мэдүүлгийг уншиж, тэнхимийн эрхлэгч болон олгох цэгийн техникч цагдаад юу хэлснийг шалгаарай.',
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
    title: 'Нэмэлт сэжүүр: зогсолтгүй дуугарсан хаалга',
    body:
      'Үйлчлэгч Баруун бөмбөгөрийн хаалгаар нэг л карт дахин дахин орж ирж байсан гэж бодсон. 16-ны шөнө хүн бүр Баруун бөмбөгөрт хэдэн удаа орсныг GROUP BY-аар тоолж, HAVING ашиглан дор хаяж гурван удаа орсон хүмүүсийг л үлдээж чадах уу?',
  },
};

export const CASES = { en, mn };
export const LANGUAGES = ['en', 'mn'];

export function getCase(lang) {
  return CASES[lang] ?? CASES.en;
}
