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
  WHEN 'Instrumentation'   THEN 'Багаж хэрэгсэл'
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
  WHEN 'Instrumentation Engineer'    THEN 'Багаж хэрэгслийн инженер'
  WHEN 'Loan Desk Technician'        THEN 'Олгох цэгийн техникч'
  WHEN 'Facilities Manager'          THEN 'Аж ахуйн менежер'
  WHEN 'Night Custodian'             THEN 'Шөнийн үйлчлэгч'
  WHEN 'Day Custodian'               THEN 'Өдрийн үйлчлэгч'
  WHEN 'Security Officer'            THEN 'Хамгаалалтын ажилтан'
  WHEN 'Observatory Director'        THEN 'Ажиглалтын төвийн захирал'
  WHEN 'Events Coordinator'          THEN 'Арга хэмжээний зохицуулагч'
  WHEN 'IT Administrator'            THEN 'МТ-ийн администратор'
  WHEN 'Gift Shop Clerk'             THEN 'Бэлэг дурсгалын дэлгүүрийн худалдагч'
  WHEN 'Volunteer Docent'            THEN 'Сайн дурын хөтөч'
  WHEN 'Volunteer Astrophotographer' THEN 'Сайн дурын одон орны гэрэл зурагчин'
  WHEN 'Donor'                       THEN 'Хандивлагч'
  WHEN 'Board Member'                THEN 'Удирдах зөвлөлийн гишүүн'
  WHEN 'Science Journalist'          THEN 'Шинжлэх ухааны сэтгүүлч'
  WHEN 'High School Teacher'         THEN 'Ахлах сургуулийн багш'
  WHEN 'Software Engineer'           THEN 'Програм хангамжийн инженер'
  WHEN 'Retired Pilot'               THEN 'Тэтгэвэрт гарсан нисгэгч'
  WHEN 'Amateur Astronomer'          THEN 'Сонирхогч одон орон судлаач'
  WHEN 'Catering Lead'               THEN 'Хоол үйлчилгээний ахлагч'
  WHEN 'Physics Undergraduate'       THEN 'Физикийн оюутан'
  ELSE occupation END;

-- ---------------------------------------------------------------------
-- crime_reports: location, type, description
-- ---------------------------------------------------------------------
UPDATE crime_reports SET type = CASE type
  WHEN 'murder'      THEN 'аллага'
  WHEN 'theft'       THEN 'хулгай'
  WHEN 'vandalism'   THEN 'эвдэн сүйтгэх'
  WHEN 'burglary'    THEN 'нэвтэрч хулгайлах'
  WHEN 'assault'     THEN 'халдлага'
  WHEN 'trespassing' THEN 'хууль бусаар нэвтрэх'
  WHEN 'fraud'       THEN 'залилан'
  ELSE type END;

UPDATE crime_reports SET location = CASE location
  WHEN 'Pinecrest Planetarium - Projector Room'             THEN 'Пайнкрест планетари - Проекторын өрөө'
  WHEN 'Larkspur Falls Public Library'                      THEN 'Ларкспур Фоллс нийтийн номын сан'
  WHEN 'Halvorsen Ridge Observatory - Parking Lot'          THEN 'Халворсен Ридж ажиглалтын төв - Зогсоол'
  WHEN 'Larkspur Falls Marina'                              THEN 'Ларкспур Фоллс завины боомт'
  WHEN 'Halvorsen Ridge Observatory - Gift Shop'            THEN 'Халворсен Ридж ажиглалтын төв - Бэлэг дурсгалын дэлгүүр'
  WHEN 'Larkspur Falls - Copper Kettle Diner'               THEN 'Ларкспур Фоллс - «Зэс данх» хоолны газар'
  WHEN 'Halvorsen Ridge Observatory - Visitor Entrance'     THEN 'Халворсен Ридж ажиглалтын төв - Зочдын орц'
  WHEN 'Route 9 Scenic Overlook'                            THEN '9-р замын үзэсгэлэнт цэг'
  WHEN 'Halvorsen Ridge Observatory - West Dome'            THEN 'Халворсен Ридж ажиглалтын төв - Баруун бөмбөгөр'
  WHEN 'Larkspur Falls - Main Street'                       THEN 'Ларкспур Фоллс - Төв гудамж'
  WHEN 'Halvorsen Ridge Observatory - Astrophysics Offices' THEN 'Халворсен Ридж ажиглалтын төв - Астрофизикийн оффис'
  WHEN 'Larkspur Falls - Farmers Market'                    THEN 'Ларкспур Фоллс - Фермерийн зах'
  ELSE location END;

UPDATE crime_reports SET description = 'Сүүлчийн үзүүлбэрийн дараа проекторчин нас барсан байдалтай олдсон. Хуучин ажилтныг 2026-08-25-нд баривчилсан. Хэрэг хаагдсан.' WHERE id = 1;
UPDATE crime_reports SET description = '1890-ээд оны ховор одны атлас уншлагын танхимаас алга болжээ. Хүчээр нэвтэрсэн шинж алга.' WHERE id = 2;
UPDATE crime_reports SET description = 'Зочдын автобусыг шүршдэг будгаар будаж сүйтгэсэн. Гэрч байхгүй; хамгаалалтын камер зогсоолыг хамардаггүй.' WHERE id = 3;
UPDATE crime_reports SET description = 'Цоожтой завины агуулахаас хоёр моторыг авч явжээ.' WHERE id = 4;
UPDATE crime_reports SET description = 'Сургуулийн аяллын дараа солирон чулуун хоёр цаас дарагч алга болсон. Худалдагч нь хулгайч байх гэж сэжиглэж байна.' WHERE id = 5;
UPDATE crime_reports SET description = 'Суудлын төлөөх маргаан түлхэлцээ болж хувирсан. Хоёр талыг хоёуланг нь торгосон.' WHERE id = 6;
UPDATE crime_reports SET description = 'Нэгэн зочин үдэшлэгт бүртгүүлж байх хооронд дугуйг нь тавиураас авч явсан гэж мэдэгджээ.' WHERE id = 7;
UPDATE crime_reports SET description = 'Хаалтын цагаас хойш хаалт давж орсон хэсэг өсвөр насныхныг олж, анхааруулаад гэрт нь явуулсан.' WHERE id = 8;
UPDATE crime_reports SET description = 'Доктор Imogen Varga Баруун бөмбөгөр дотор, дээд явган гүүрний шатны доор 00:35-д нас барсан байдалтай олдов; цагдааг 00:40-д дуудсан. Толгойдоо гэмтэлтэй. Хажууд нь дурангийн суурийн гуулин тэнцвэржүүлэгч жин хэвтэж байв. Шүүх эмнэлгийн шинжээч нас барсан цагийг 23:45-аас 00:05-ын хооронд гэж тогтоосон. Зөөврийн компьютер нь ширээн дээр байсан ч гадаад хатуу диск олдсонгүй. Хоёр гэрч мэдүүлэг өгсөн: цогцсыг олсон шөнийн үйлчлэгч, мөн оройн сүүлээр бөмбөгөр хоорондын коридороор явж байсан Priya нэртэй сайн дурын хөтөч.' WHERE id = 9;
UPDATE crime_reports SET description = 'Төмөр эдлэлийн дэлгүүрийн гаднах цонх хагарсан. Чулуу шидсэн бололтой.' WHERE id = 10;
UPDATE crime_reports SET description = 'Тэнхимийн эрхлэгчийн мэдээлснээр Доктор Imogen Varga хэрэглэдэг байсан «C/2026 K3 спектр» гэсэн шошготой гадаад хатуу диск алга болжээ. Хэргийн газраас ч, түүний оффисоос ч олдоогүй.' WHERE id = 11;
UPDATE crime_reports SET description = 'Худалдагчид хуурамч хорин долларын гурван дэвсгэртээр төлбөр хийжээ.' WHERE id = 12;

-- ---------------------------------------------------------------------
-- interviews: transcript
-- ---------------------------------------------------------------------
UPDATE interviews SET transcript = 'Арван нэгэн цаг хагасаас эхлэн бөмбөгөрийн коридорыг угааж байлаа. 23:51-д Баруун бөмбөгөрийн хаалгаар нэг хүн яаран гарч ирсэн. Хүрэмнийхээ малгайг өмссөн, гартаа тоног төхөөрөмж олгох цэгийнх шиг урт хар хатуу хайрцаг барьсан байсан. Улаан оосор нь савлаж байхыг харсан, тэгэхээр ажилтан байсан, сайн дурын ажилтан ч биш, зочин ч биш. Царайг нь огт хараагүй. Тэр хаалга орой турш дуугарсаар байсан. Нэг л хүн дахин дахин ирээд байх шиг санагдсан. 00:35-д түгжихээр ороход Доктор Varga шатны доор хэвтэж байсан.' WHERE id = 1;
UPDATE interviews SET transcript = 'Зүүн бөмбөгөр дэх миний сүүлийн аялал арван нэгэн хагасаас хойш удалгүй дууссан. 23:40 орчимд коридороор явж байтал Баруун бөмбөгөрөөс Доктор Varga их ууртай ярих нь сонсогдсон. «Тэр чинь миний спектр, чи өөрөө мэдэж байгаа» гэж хэлсэн. Нэг эрэгтэй хүн өгүүлэл аль хэдийн илгээгдчихсэн, чи юу ч нотолж чадахгүй гэж хариулсан. Би хутгалдахыг хүсээгүй тул солир ажиглалт руу дээврийн тавцан дээр гарсан.' WHERE id = 2;
UPDATE interviews SET transcript = 'Арван хоёр болохоос арван таван минутын өмнө орчим өлгүүр дээр мартсан хүрэмээ авах гэж Баруун бөмбөгөрт орсон. Доктор Varga дээд явган гүүр дээр бараан малгайтай цамц өмссөн хэн нэгэнтэй хамт байсан. Улаан оосортой, хөлийнх нь дэргэд шалан дээр урт хар хайрцаг байсан. Тэр намайг яв гэж зандарсан болохоор хүрэмээ аваад дээвэр рүү гарсан.' WHERE id = 3;
UPDATE interviews SET transcript = 'Арван нэгэн цаг арван таван минутаас Баруун бөмбөгөрийн хаалтын моторыг засаж байлаа. Доктор Varga бүтэн хугацаанд зөөврийн компьютер дээрээ ажиллаж байсан, ямар ч асуудалгүй. 23:20 орчимд хаалга нээгдээд нэг хүн шагайж, намайг хараад дуу шуугүй буцаад явсан. Хэн болохыг нь харж амжаагүй. 23:24-д дуусгаад ажилчдын амралтын өрөө рүү явсан.' WHERE id = 4;
UPDATE interviews SET transcript = 'Од дагагч суурийг 23:19-д олгох цэгийн шүүгээнд буцааж тавиад, 23:35 орчимд Imogen-ий ширээн дээр хэвлэсэн одны зургуудыг тавьсан. Тэр гадаад хатуу дискээ залгасан байсан бөгөөд нэг хүн хүлээж байна гэж хэлсэн. Би гурван минутын дотор орж гараад шууд дээврийн тавцан руу явсан.' WHERE id = 5;
UPDATE interviews SET transcript = 'Би арван нэгэн хагас хүртэл үдэшлэгт байгаад шууд дээврийн тавцан руу солир ажиглалтад гарсан. Шөнөжингөө Баруун бөмбөгөрийн ойролцоо ч очоогүй. Даваа гарагт хэрэгтэй болохоор тохируулгыг нь шалгах гэж зөөврийн спектрограф өмнө нь авсан, гэхдээ буцааж өгсөн. Imogen бид хоёр маш сайн хамтран ажилладаг байсан.' WHERE id = 6;
UPDATE interviews SET transcript = 'Би 23:40 хүртэл үдэшлэгт байгаад дээвэр рүү гарсан. Imogen долоо хоногийн турш их түгшүүртэй байсан. Түүний нэг өгөгдөл байх ёсгүй газар гарч ирсэн юм шиг байсан.' WHERE id = 7;
UPDATE interviews SET transcript = 'Би 22:30 орчмоос 600мм-ийн линзээр солирын бороог зураг авахаар дээврийн тавцан дээр байсан. Шөнө дундаас хойш л доош буусан. Гарах замдаа 00:25-д линзээ буцааж өгсөн.' WHERE id = 8;
UPDATE interviews SET transcript = 'Зүүн бөмбөгөрт үзүүлэх гэж 21:20-д нарны дуран авсан, тэгээд буцааж өгөхөө огт мартчихсан. Одоо ч магистрантуудын өрөөний шүүгээнд минь байгаа. 23:35-аас бусадтай хамт дээвэр дээр солир харж байсан.' WHERE id = 9;
UPDATE interviews SET transcript = 'Карттай хаалга бүр орсон, гарсан хоёр чиглэлийг хоёуланг нь бүртгэдэг, цаг нь минут хүртэл тохируулагдсан. Ажилтнууд улаан оосор зүүдэг. Сайн дурын хөтөлбөрийнхөн цэнхэр оосортой. Зочдод карт огт өгдөггүй, тэд нийтийн шатаар явдаг. Харамсалтай нь бөмбөгөрийн коридорын камер долоо хоногийн турш засвартай байсан.' WHERE id = 10;
UPDATE interviews SET transcript = 'Ирсэн хүн бүр киоскоор бүртгүүлдэг тул ирсэн цагийн бүртгэл найдвартай. Гарахдаа бүртгүүлэх нь заавал биш, ихэнх нь зүгээр л гараад явчихдаг. Тиймээс гарсан бүртгэл байхгүй байх нь тийм ч их зүйлийг хэлэхгүй. Солир ажиглалт дээврийн тавцан дээр тусдаа киосктой байсан, 23:45-д нээгдсэн.' WHERE id = 11;
UPDATE interviews SET transcript = 'Баасан гарагийн үдээс хойш Imogen надад саяхан сэтгүүлд илгээгдсэн нэгэн өгүүллийг үзүүлсэн. Түүний C/2026 K3 сүүлт одны спектрийг бараг мөр мөрөөр нь ашигласан, гэхдээ өөрийнх нь бүлгийн докторын дараах судлаачийн нэрээр. Тэр даваа гарагт эрдэм шинжилгээний ёс зүйн зөрчлийн гомдол гаргах гэж байсан. Анхны өгөгдлөө хаа явсан газраа авч явдаг гадаад хатуу дискэндээ хадгалдаг байсан. Одоо тэр диск алга болсон.' WHERE id = 12;
UPDATE interviews SET transcript = 'Орой 22:00-аас хойш олгох цэг өөртөө үйлчлэх шүүгээгээр ажилладаг. Картаа уншуулаад, юмаа аваад, систем нь өөрөө бүртгэчихдэг. Өнөө өглөө 07:58-д буцаж ирсэн зөөврийн спектрографыг шалгасан. Хэн нэгэн хайрцагны хөөсөн доторлогооны нэг булангийн хэсгийг хайчилж авсан байсан, жижиг юм багтаах зай гаргасан юм шиг. Магадгүй хатуу диск.' WHERE id = 13;
UPDATE interviews SET transcript = '21:40 орчимд үдэшлэг дээр Доктор Varga-тай ярилцлага хийсэн. Нууцаар надад ирэх долоо хоногт «шинжлэх ухааны шударга байдлын тухай том мэдээ» гарна гэж хэлсэн. Баярласан гэхээсээ илүү уурласан харагдаж байсан.' WHERE id = 14;
UPDATE interviews SET transcript = 'Би 21:00-д бэлэг дурсгалын дэлгүүрээ хаагаад гэр лүүгээ явсан. Та нөгөө Priya-г хайж байгаа байх. Тэр бөмбөгөрүүдээр аялал хөтөлж байсан.' WHERE id = 15;
UPDATE interviews SET transcript = 'Би өдрийн ээлжинд ажилладаг. Таван цагт явсан; шөнийн ээлжинд Tomas байсан.' WHERE id = 16;
UPDATE interviews SET transcript = 'Сайхан үдэш байлаа. Harold бид хоёр арван цаг хагасын орчимд хамт явсан. Ер бусын юм харсангүй.' WHERE id = 17;
UPDATE interviews SET transcript = 'Би есөн цагт хандивлагчдад хундага өргөх үг хэлээд арван нэгэн цаг өнгөрөхөд явсан. Imogen манай хамгийн шилдэг одон орон судлаач байсан. Итгэж ч чадахгүй байна.' WHERE id = 18;

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
  WHEN 'Loaner laptop'                               THEN 'Түр олгох зөөврийн компьютер'
  WHEN 'Portable spectrograph (long hard case)'      THEN 'Зөөврийн спектрограф (урт хатуу хайрцаг)'
  WHEN '80mm refractor telescope (long hard case)'   THEN '80мм рефрактор дуран (урт хатуу хайрцаг)'
  WHEN 'Floor buffer'                                THEN 'Шал өнгөлөгч машин'
  WHEN 'Ticket scanner kiosk'                        THEN 'Тасалбар уншигч киоск'
  WHEN 'Projector remote'                            THEN 'Проекторын удирдлага'
  WHEN 'Red LED flashlight'                          THEN 'Улаан гэрэлтэй гар чийдэн'
  WHEN 'Planisphere teaching set (flat box)'         THEN 'Одны зургийн сургалтын иж бүрдэл (хавтгай хайрцаг)'
  WHEN 'Green laser pointer'                         THEN 'Ногоон лазер заагч'
  WHEN 'Spectral calibration lamp (small hard case)' THEN 'Спектрийн тохируулгын чийдэн (жижиг хатуу хайрцаг)'
  WHEN 'Star tracker mount (long hard case)'         THEN 'Од дагагч суурь (урт хатуу хайрцаг)'
  WHEN '600mm telephoto lens (long hard case)'       THEN '600мм телефото линз (урт хатуу хайрцаг)'
  WHEN 'Solar telescope (long hard case)'            THEN 'Нарны дуран (урт хатуу хайрцаг)'
  WHEN 'Wet-floor signs (set of 4)'                  THEN '«Шал нойтон» тэмдэг (4 ширхэг)'
  WHEN 'Torque wrench kit (small hard case)'         THEN 'Моментын түлхүүрийн иж бүрдэл (жижиг хатуу хайрцаг)'
  WHEN 'Binoculars 15x70'                            THEN 'Хоёр нүдний дуран 15x70'
  ELSE item_name END;

-- ---------------------------------------------------------------------
-- event_attendance: event_name, location
-- ---------------------------------------------------------------------
UPDATE event_attendance SET event_name = CASE event_name
  WHEN 'Members Lecture: Comets Up Close' THEN 'Гишүүдийн лекц: Сүүлт од ойроос'
  WHEN 'Autumn Star Party Gala'           THEN 'Намрын одны үдэшлэг'
  WHEN 'Midnight Meteor Watch'            THEN 'Шөнө дундын солир ажиглалт'
  ELSE event_name END;

UPDATE event_attendance SET location = CASE location
  WHEN 'Main Hall' THEN 'Их танхим'
  WHEN 'Roof Deck' THEN 'Дээврийн тавцан'
  ELSE location END;
