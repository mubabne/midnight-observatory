-- =====================================================================
--  Монгол хувилбар (Mongolian translation overlay)
--
--  Runs AFTER seed.sql when the game is in Mongolian. It only translates
--  text: every id, timestamp and relationship stays exactly the same, so
--  the mystery solves identically in both languages (see tests).
--
--  Not translated on purpose:
--    * table and column names (SQL identifiers stay English)
--    * people.name (kept in Latin script so accusations are unambiguous)
--    * timestamps
-- =====================================================================

-- ---------------------------------------------------------------------
-- people: occupation, department
-- ---------------------------------------------------------------------
UPDATE people SET department = CASE department
  WHEN 'Astrophysics'      THEN 'Астрофизик'
  WHEN 'Instrumentation'   THEN 'Багаж төхөөрөмж'
  WHEN 'Facilities'        THEN 'Аж ахуй'
  WHEN 'Administration'    THEN 'Захиргаа'
  WHEN 'Volunteer Program' THEN 'Сайн дурын хөтөлбөр'
  WHEN 'Visitor'           THEN 'Зочин'
  ELSE department END;

UPDATE people SET occupation = CASE occupation
  WHEN 'Senior Astronomer'           THEN 'Ахлах одон орон судлаач'
  WHEN 'Department Chair'            THEN 'Тэнхимийн эрхлэгч'
  WHEN 'Research Astronomer'         THEN 'Одон орон судлаач'
  WHEN 'Postdoctoral Researcher'     THEN 'Докторын дараах судлаач'
  WHEN 'Graduate Student'            THEN 'Магистрант'
  WHEN 'Instrumentation Engineer'    THEN 'Багаж төхөөрөмжийн инженер'
  WHEN 'Loan Desk Technician'        THEN 'Тоног төхөөрөмж хариуцсан техникч'
  WHEN 'Facilities Manager'          THEN 'Аж ахуйн эрхлэгч'
  WHEN 'Night Custodian'             THEN 'Шөнийн үйлчлэгч'
  WHEN 'Day Custodian'               THEN 'Өдрийн үйлчлэгч'
  WHEN 'Security Officer'            THEN 'Хамгаалалтын ажилтан'
  WHEN 'Observatory Director'        THEN 'Одон орны төвийн захирал'
  WHEN 'Events Coordinator'          THEN 'Арга хэмжээний зохицуулагч'
  WHEN 'IT Administrator'            THEN 'МТ-ийн администратор'
  WHEN 'Gift Shop Clerk'             THEN 'Бэлэг дурсгалын дэлгүүрийн худалдагч'
  WHEN 'Volunteer Docent'            THEN 'Сайн дурын хөтөч'
  WHEN 'Volunteer Astrophotographer' THEN 'Одон орны зураг авдаг сайн дурын гэрэл зурагчин'
  WHEN 'Donor'                       THEN 'Хандивлагч'
  WHEN 'Board Member'                THEN 'Удирдах зөвлөлийн гишүүн'
  WHEN 'Science Journalist'          THEN 'Шинжлэх ухааны сэтгүүлч'
  WHEN 'High School Teacher'         THEN 'Ахлах сургуулийн багш'
  WHEN 'Software Engineer'           THEN 'Програм хангамжийн инженер'
  WHEN 'Retired Pilot'               THEN 'Тэтгэвэрт гарсан нисгэгч'
  WHEN 'Amateur Astronomer'          THEN 'Сонирхогч одон орон судлаач'
  WHEN 'Catering Lead'               THEN 'Хоолны үйлчилгээний ахлагч'
  WHEN 'Physics Undergraduate'       THEN 'Физикийн оюутан'
  ELSE occupation END;

-- ---------------------------------------------------------------------
-- crime_reports: location, type, description
-- ---------------------------------------------------------------------
UPDATE crime_reports SET type = CASE type
  WHEN 'murder'      THEN 'аллага'
  WHEN 'theft'       THEN 'хулгай'
  WHEN 'vandalism'   THEN 'эд хөрөнгө эвдэн сүйтгэх'
  WHEN 'burglary'    THEN 'нэвтэрч үйлдсэн хулгай'
  WHEN 'assault'     THEN 'биед халдах'
  WHEN 'trespassing' THEN 'хууль бусаар нэвтрэх'
  WHEN 'fraud'       THEN 'залилан'
  ELSE type END;

UPDATE crime_reports SET location = CASE location
  WHEN 'Pinecrest Planetarium - Projector Room'             THEN 'Пайнкрестийн одон орны үзүүлбэрийн төв - Проекторын өрөө'
  WHEN 'Larkspur Falls Public Library'                      THEN 'Ларкспур Фоллс нийтийн номын сан'
  WHEN 'Halvorsen Ridge Observatory - Parking Lot'          THEN 'Халворсен Риджийн одон орны төв - Зогсоол'
  WHEN 'Larkspur Falls Marina'                              THEN 'Ларкспур Фоллс завины боомт'
  WHEN 'Halvorsen Ridge Observatory - Gift Shop'            THEN 'Халворсен Риджийн одон орны төв - Бэлэг дурсгалын дэлгүүр'
  WHEN 'Larkspur Falls - Copper Kettle Diner'               THEN 'Ларкспур Фоллс - «Зэс данх» хоолны газар'
  WHEN 'Halvorsen Ridge Observatory - Visitor Entrance'     THEN 'Халворсен Риджийн одон орны төв - Зочдын орц'
  WHEN 'Route 9 Scenic Overlook'                            THEN '9-р замын дагуух байгаль харах тавцан'
  WHEN 'Halvorsen Ridge Observatory - West Dome'            THEN 'Халворсен Риджийн одон орны төв - Баруун бөмбөгөр'
  WHEN 'Larkspur Falls - Main Street'                       THEN 'Ларкспур Фоллс - Төв гудамж'
  WHEN 'Halvorsen Ridge Observatory - Astrophysics Offices' THEN 'Халворсен Риджийн одон орны төв - Астрофизикийн тэнхимийн өрөөнүүд'
  WHEN 'Larkspur Falls - Farmers Market'                    THEN 'Ларкспур Фоллс - Тариаланчдын зах'
  ELSE location END;

UPDATE crime_reports SET description = 'Сүүлчийн үзүүлбэрийн дараа проекторын оператор нас барсан байдалтай олджээ. Өмнө нь энд ажиллаж байсан хүнийг 2026-08-25-нд баривчилсан. Хэргийг хаасан.' WHERE id = 1;
UPDATE crime_reports SET description = '1890-ээд оны ховор одны атлас уншлагын танхимаас алга болжээ. Хүчээр нэвтэрсэн ул мөр олдоогүй.' WHERE id = 2;
UPDATE crime_reports SET description = 'Зочдын автобусыг шүршдэг будгаар эрээчсэн байна. Гэрч олдоогүй. Хамгаалалтын камерын харах хүрээнд зогсоол ордоггүй.' WHERE id = 3;
UPDATE crime_reports SET description = 'Цоожтой завины агуулахаас завины хоёр хөдөлгүүр хулгайлжээ.' WHERE id = 4;
UPDATE crime_reports SET description = 'Сургуулийн сурагчдын аяллын дараа солирын чулуугаар хийсэн хоёр цаас дарагч алга болжээ. Дэлгүүрийн худалдагч хулгайд алдсан гэж сэжиглэж байна.' WHERE id = 5;
UPDATE crime_reports SET description = 'Суудал булаацалдсан маргаан даамжирч, хоёр тал бие биеэ түлхжээ. Хоёр талд хоёуланд нь зөрчлийн мэдэгдэл өгсөн.' WHERE id = 6;
UPDATE crime_reports SET description = 'Нэгэн зочин хандивын үдэшлэгт бүртгүүлж байх хоорондоо тавиурт үлдээсэн унадаг дугуйгаа алдсан гэж мэдүүлжээ.' WHERE id = 7;
UPDATE crime_reports SET description = 'Хаалтын цагаас хойш хаалганы цаана орсон хэсэг өсвөр насныхныг илрүүлж, анхааруулаад гэрт нь явуулжээ.' WHERE id = 8;
UPDATE crime_reports SET description = 'Доктор Imogen Varga 00:35 цагт Баруун бөмбөгөр танхимын дээд талын явган тавцан руу өгсөх шатны хормойд нас барсан байдалтай олджээ. Цагдааг 00:40 цагт дуудсан. Хохирогч толгойдоо гэмтэлтэй, дэргэд нь дурангийн суурийн гуулин тэнцвэржүүлэгч туухай байсан. Шүүх эмнэлгийн шинжээч нас барсан цагийг 23:45-аас 00:05-ын хооронд гэж тогтоожээ. Зөөврийн компьютер нь ширээн дээр байсан ч гадаад хатуу диск нь олдоогүй. Цогцсыг олсон шөнийн үйлчлэгч болон орой нь бөмбөгөр танхимуудыг холбосон коридороор явсан Priya нэртэй сайн дурын хөтөч хоёр гэрчээр мэдүүлэг өгсөн.' WHERE id = 9;
UPDATE crime_reports SET description = 'Барилгын багаж, хэрэгслийн дэлгүүрийн гадна талын цонх цуурсан байна. Чулуу шидсэн бололтой.' WHERE id = 10;
UPDATE crime_reports SET description = 'Тэнхимийн эрхлэгч доктор Imogen Varga хэрэглэдэг байсан «C/2026 K3 спектр» гэсэн шошготой гадаад хатуу диск алга болсныг мэдэгджээ. Дискийг хэргийн газраас ч, түүний ажлын өрөөнөөс ч олоогүй.' WHERE id = 11;
UPDATE crime_reports SET description = 'Нэгэн худалдаачинд 20 долларын гурван хуурамч дэвсгэртээр төлбөр хийжээ.' WHERE id = 12;

-- ---------------------------------------------------------------------
-- interviews: transcript
-- ---------------------------------------------------------------------
UPDATE interviews SET transcript = 'Оройн арван нэгэн цаг хагасын үеэс бөмбөгөр танхимуудын коридорын шалыг угааж байлаа. 23:51 цагт Баруун бөмбөгөр танхимын хаалгаар нэг хүн яаран гарч ирсэн. Цамцныхаа малгайг өмсөж, тоног төхөөрөмж олгодог цэгийн урт хар хатуу хайрцаг барьсан байсан. Улаан оосор нь савлаж харагдсан. Тэгэхээр үндсэн ажилтан байсан гэсэн үг. Сайн дурын ажилтан ч биш, зочин ч биш. Царайг нь хараагүй. Тэр хаалганы карт уншигч оройжин дуугарсан. Нэг хүн дахин дахин ирээд байх шиг санагдсан. 00:35 цагт хаалгыг түгжихээр ороход доктор Varga шатны хормойд хэвтэж байсан.' WHERE id = 1;
UPDATE interviews SET transcript = 'Зүүн бөмбөгөр танхимд хөтөлсөн сүүлийн аялал маань оройн арван нэгэн цаг хагасаас хойш удалгүй дууссан. 23:40 орчимд коридороор явж байтал Баруун бөмбөгөр танхимд доктор Varga ууртай ярих нь сонсогдсон. «Тэр спектрийн өгөгдөл чинь минийх гэдгийг чи мэдэж байгаа» гэсэн. Нэг эрэгтэй хүн «Өгүүлэл аль хэдийн илгээгдчихсэн. Чи юу ч нотолж чадахгүй» гэж хариулсан. Би тэдний хэрэгт оролцохыг хүсээгүй болохоор солир ажиглахаар дээврийн тавцан руу гарсан.' WHERE id = 2;
UPDATE interviews SET transcript = 'Шөнө дунд болохоос арван тав орчим минутын өмнө өлгүүрт мартсан хүрмээ авах гэж Баруун бөмбөгөр танхимд орсон. Доктор Varga дээд талын явган тавцан дээр бараан өнгийн малгайтай цамц өмссөн хүнтэй хамт байсан. Тэр хүн улаан оосортой, хөлийнх нь дэргэд урт хар хайрцаг байсан. Доктор Varga намайг яв гэж зандарсан болохоор хүрмээ аваад дээвэр рүү гарсан.' WHERE id = 3;
UPDATE interviews SET transcript = 'Оройн арван нэгэн цаг арван таван минутаас Баруун бөмбөгөр танхимын хаалтын хөдөлгүүрийг засаж байлаа. Тэр хугацаанд доктор Varga зөөврийн компьютер дээрээ ажиллаж байсан. Зүгээр л харагдсан. 23:20 орчимд хаалга нээгдэж, нэг хүн шагайснаа намайг хараад юу ч хэлэлгүй буцаад явсан. Хэн байсныг нь харж амжаагүй. Би 23:24 цагт ажлаа дуусгаад ажилчдын амралтын өрөө рүү явсан.' WHERE id = 4;
UPDATE interviews SET transcript = 'Би 23:19 цагт од дагагч суурийг тоног төхөөрөмжийн шүүгээнд буцааж тавьсан. Дараа нь 23:35 орчимд Imogen-ий ширээн дээр хэвлэсэн одны зургуудыг хүргэж өгсөн. Тэр гадаад хатуу дискээ компьютертээ залгасан байсан. Бас нэг хүн хүлээж байгаа гэж хэлсэн. Би гуравхан минут болоод шууд дээврийн тавцан руу явсан.' WHERE id = 5;
UPDATE interviews SET transcript = 'Би оройн арван нэгэн цаг хагас хүртэл үдэшлэгт байгаад шууд дээврийн тавцан руу солир ажиглахаар гарсан. Тэр шөнө Баруун бөмбөгөр танхимын ойролцоо ч очоогүй. Даваа гарагт ашиглах зөөврийн спектрографын тохируулгыг шалгах гэж өмнө нь зээлж авсан л даа. Гэхдээ буцааж өгсөн. Imogen бид хоёр ажлын хувьд маш сайн харилцаатай байсан.' WHERE id = 6;
UPDATE interviews SET transcript = 'Би 23:40 орчим хүртэл үдэшлэгт байгаад дээвэр рүү гарсан. Imogen долоо хоногийн турш санаа зовсон байдалтай байсан. Түүний судалгааны нэг багц өгөгдөл байх ёсгүй газар гарч ирсэн гэсэн юм шиг байсан.' WHERE id = 7;
UPDATE interviews SET transcript = 'Би 22:30 орчмоос дээврийн тавцан дээр 600 мм-ийн линзээр солирын борооны зураг авч байсан. Шөнө дундаас хойш л доош буусан. Гэртээ харих замдаа 00:25 цагт линзээ буцааж өгсөн.' WHERE id = 8;
UPDATE interviews SET transcript = 'Зүүн бөмбөгөр танхимд үзүүлэхээр 21:20 цагт нарны дуран зээлж авсан. Тэгээд буцааж өгөхөө бүр мартчихсан. Одоо ч магистрантуудын өрөөн дэх шүүгээнд минь байгаа. 23:35 цагаас бусадтай хамт дээвэр дээр солир ажиглаж байсан.' WHERE id = 9;
UPDATE interviews SET transcript = 'Карт уншигчтай бүх хаалга орсон, гарсан бүрийг бүртгэдэг. Уншигчдын цагийг минутын нарийвчлалтай ижил тохируулсан. Үндсэн ажилтнууд улаан оосор, Сайн дурын хөтөлбөрийнхөн цэнхэр оосор зүүдэг. Зочдод карт өгдөггүй. Тэд нийтэд нээлттэй шатаар явдаг. Харамсалтай нь бөмбөгөр танхимуудын коридорын камер долоо хоногийн турш засвартай байсан.' WHERE id = 10;
UPDATE interviews SET transcript = 'Ирсэн хүн бүр киоскт бүртгүүлдэг тул ирсэн цагийн бүртгэл найдвартай. Харин гарахдаа бүртгүүлэх албагүй. Ихэнх хүн шууд л явчихдаг. Тиймээс гарсан цаг нь бүртгэгдээгүй байлаа гээд тэнд үлдсэн гэж бодож болохгүй. Солир ажиглах арга хэмжээ дээврийн тавцан дээр тусдаа киосктой байсан. Тэр киоск 23:45 цагт нээгдсэн.' WHERE id = 11;
UPDATE interviews SET transcript = 'Баасан гарагийн үдээс хойш Imogen надад сэтгүүлд дөнгөж илгээсэн нэг өгүүлэл үзүүлсэн. Тэр өгүүлэлд түүний C/2026 K3 сүүлт одны спектрийн өгөгдлийг бараг тэр чигээр нь ашигласан байсан. Гэтэл зохиогчоор нь өөрийнх нь багийн докторын дараах судлаач нэрээ тавьсан байв. Imogen даваа гарагт судалгааны ёс зүйн зөрчлийн талаар гомдол гаргахаар төлөвлөж байсан. Тэр анхны өгөгдлөө үргэлж авч явдаг гадаад хатуу дискэндээ хадгалдаг байсан. Одоо тэр диск алга болсон.' WHERE id = 12;
UPDATE interviews SET transcript = '22:00 цагаас хойш тоног төхөөрөмжийг өөртөө үйлчлэх шүүгээнээс авдаг. Картаа уншуулаад төхөөрөмжөө авахад систем автоматаар бүртгэнэ. Өнөө өглөө 07:58 цагт буцааж өгсөн зөөврийн спектрографыг шалгасан. Хайрцагны хөөсөн доторлогооны нэг буланг хэн нэгэн хайчилж авсан байсан. Жижиг зүйл багтаах зай гаргасан юм шиг. Магадгүй хатуу диск багтаах гэсэн байх.' WHERE id = 13;
UPDATE interviews SET transcript = 'Би 21:40 орчимд үдэшлэг дээр доктор Varga-тай ярилцлага хийсэн. Тэр надад нийтлэхгүй байхыг хүсээд, ирэх долоо хоногт «шинжлэх ухааны ёс зүйн талаар том мэдээ» дуулгана гэсэн. Догдолсон гэхээсээ илүү ууртай харагдсан.' WHERE id = 14;
UPDATE interviews SET transcript = 'Би 21:00 цагт бэлэг дурсгалын дэлгүүрээ хаагаад гэртээ харьсан. Та нар нөгөө Priya-г хайж байгаа байх. Тэр бөмбөгөр танхимуудаар аялал хөтөлж байсан.' WHERE id = 15;
UPDATE interviews SET transcript = 'Би өдрийн ээлжинд ажилладаг. Оройн таван цагт ажлаа тараад явсан. Шөнийн ээлжинд Tomas ажилласан.' WHERE id = 16;
UPDATE interviews SET transcript = 'Сайхан үдэш болсон. Harold бид хоёр оройн арван цаг хагасын орчимд хамт явсан. Содон зүйл хараагүй.' WHERE id = 17;
UPDATE interviews SET transcript = 'Би оройн есөн цагт хандивлагчдад зориулж хундаганы үг хэлсэн. Арван нэгэн цаг өнгөрөөд явсан. Imogen манай хамгийн шилдэг одон орон судлаач байсан. Ийм зүйл болсон гэдэгт итгэж чадахгүй байна.' WHERE id = 18;

-- ---------------------------------------------------------------------
-- access_logs: location, direction
-- ---------------------------------------------------------------------
UPDATE access_logs SET location = CASE location
  WHEN 'Staff Entrance' THEN 'Ажилчдын орц'
  WHEN 'West Dome'      THEN 'Баруун бөмбөгөр'
  WHEN 'East Dome'      THEN 'Зүүн бөмбөгөр'
  WHEN 'Roof Deck'      THEN 'Дээврийн тавцан'
  WHEN 'Staff Lounge'   THEN 'Ажилчдын амралтын өрөө'
  ELSE location END;

UPDATE access_logs SET direction = CASE direction
  WHEN 'in'  THEN 'орсон'
  WHEN 'out' THEN 'гарсан'
  ELSE direction END;

-- ---------------------------------------------------------------------
-- equipment_loans: item_name
-- ---------------------------------------------------------------------
UPDATE equipment_loans SET item_name = CASE item_name
  WHEN 'Loaner laptop'                               THEN 'Зээлээр олгох зөөврийн компьютер'
  WHEN 'Portable spectrograph (long hard case)'      THEN 'Зөөврийн спектрограф (урт хатуу хайрцаг)'
  WHEN '80mm refractor telescope (long hard case)'   THEN '80мм рефрактор дуран (урт хатуу хайрцаг)'
  WHEN 'Floor buffer'                                THEN 'Шал өнгөлөгч машин'
  WHEN 'Ticket scanner kiosk'                        THEN 'Тасалбар уншигч киоск'
  WHEN 'Projector remote'                            THEN 'Проекторын удирдлага'
  WHEN 'Red LED flashlight'                          THEN 'Улаан гэрэлтэй гар чийдэн'
  WHEN 'Planisphere teaching set (flat box)'         THEN 'Эргэдэг одны зургийн сургалтын иж бүрдэл (хавтгай хайрцаг)'
  WHEN 'Green laser pointer'                         THEN 'Ногоон лазер заагч'
  WHEN 'Spectral calibration lamp (small hard case)' THEN 'Спектрийн тохируулгын чийдэн (жижиг хатуу хайрцаг)'
  WHEN 'Star tracker mount (long hard case)'         THEN 'Од дагагч суурь (урт хатуу хайрцаг)'
  WHEN '600mm telephoto lens (long hard case)'       THEN '600 мм-ийн холын зураг авах линз (урт хатуу хайрцаг)'
  WHEN 'Solar telescope (long hard case)'            THEN 'Нарны дуран (урт хатуу хайрцаг)'
  WHEN 'Wet-floor signs (set of 4)'                  THEN '«Шал нойтон» тэмдэг (4 ширхэг)'
  WHEN 'Torque wrench kit (small hard case)'         THEN 'Моментын түлхүүрийн иж бүрдэл (жижиг хатуу хайрцаг)'
  WHEN 'Binoculars 15x70'                            THEN 'Хоёр нүдний дуран 15x70'
  ELSE item_name END;

-- ---------------------------------------------------------------------
-- event_attendance: event_name, location
-- ---------------------------------------------------------------------
UPDATE event_attendance SET event_name = CASE event_name
  WHEN 'Members Lecture: Comets Up Close' THEN 'Гишүүдэд зориулсан лекц: Сүүлт одтой ойроос танилцах нь'
  WHEN 'Autumn Star Party Gala'           THEN 'Намрын одны үдэшлэг'
  WHEN 'Midnight Meteor Watch'            THEN 'Шөнө дундын солир ажиглалт'
  ELSE event_name END;

UPDATE event_attendance SET location = CASE location
  WHEN 'Main Hall' THEN 'Их танхим'
  WHEN 'Roof Deck' THEN 'Дээврийн тавцан'
  ELSE location END;
