-- =====================================================================
--  Midnight at the Observatory — case evidence
--  Halvorsen Ridge Observatory, Larkspur Falls (all fictional)
--
--  This file is the single source of truth for the case. It is plain
--  SQLite and fully deterministic: running it on an empty database
--  always produces the same evidence. The browser app and the tests
--  both build the database from this file.
--
--  Time convention: every timestamp is local time, 24-hour clock,
--  stored as TEXT in the form 'YYYY-MM-DD HH:MM'. Because the format
--  is fixed-width, plain string comparison sorts chronologically:
--    accessed_at BETWEEN '2026-10-16 23:30' AND '2026-10-17 00:00'
-- =====================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE people (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  occupation  TEXT NOT NULL,
  department  TEXT NOT NULL      -- 'Volunteer Program' and 'Visitor' are not staff
);

CREATE TABLE crime_reports (
  id           INTEGER PRIMARY KEY,
  occurred_at  TEXT NOT NULL,
  location     TEXT NOT NULL,
  type         TEXT NOT NULL,
  description  TEXT NOT NULL
);

CREATE TABLE interviews (
  id           INTEGER PRIMARY KEY,
  person_id    INTEGER NOT NULL REFERENCES people(id),
  recorded_at  TEXT NOT NULL,
  transcript   TEXT NOT NULL
);

-- Badge readers on staff doors. Only staff and volunteers carry badges;
-- visitors use the public stairs and never appear here.
CREATE TABLE access_logs (
  id           INTEGER PRIMARY KEY,
  person_id    INTEGER NOT NULL REFERENCES people(id),
  location     TEXT NOT NULL,
  -- 'in'/'out' in English; the Mongolian overlay uses 'орсон'/'гарсан'.
  direction    TEXT NOT NULL CHECK (direction IN ('in', 'out', 'орсон', 'гарсан')),
  accessed_at  TEXT NOT NULL
);

-- returned_at is NULL while an item is still checked out.
CREATE TABLE equipment_loans (
  id           INTEGER PRIMARY KEY,
  person_id    INTEGER NOT NULL REFERENCES people(id),
  item_name    TEXT NOT NULL,
  borrowed_at  TEXT NOT NULL,
  returned_at  TEXT
);

-- Kiosk scans. Check-ins are reliable; check-outs are optional, so a
-- NULL checked_out_at only means the person never scanned out.
CREATE TABLE event_attendance (
  id              INTEGER PRIMARY KEY,
  person_id       INTEGER NOT NULL REFERENCES people(id),
  event_name      TEXT NOT NULL,
  location        TEXT NOT NULL,
  checked_in_at   TEXT NOT NULL,
  checked_out_at  TEXT
);

-- ---------------------------------------------------------------------
-- People (32)
-- ---------------------------------------------------------------------
INSERT INTO people (id, name, occupation, department) VALUES
  (1001, 'Imogen Varga',        'Senior Astronomer',          'Astrophysics'),
  (1002, 'Ottoline Pike',       'Department Chair',           'Astrophysics'),
  (1003, 'Rafael Moncada',      'Research Astronomer',        'Astrophysics'),
  (1004, 'Camille Duret',       'Research Astronomer',        'Astrophysics'),
  (1005, 'Lena Sato',           'Postdoctoral Researcher',    'Astrophysics'),
  (1006, 'Corin Ashdown',       'Postdoctoral Researcher',    'Astrophysics'),
  (1007, 'Ines Calloway',       'Graduate Student',           'Astrophysics'),
  (1008, 'Felix Ward',          'Graduate Student',           'Astrophysics'),
  (1009, 'Hattie Kowalczyk',    'Instrumentation Engineer',   'Instrumentation'),
  (1010, 'Wendell Fairbanks',   'Loan Desk Technician',       'Instrumentation'),
  (1011, 'Marisol Quint',       'Facilities Manager',         'Facilities'),
  (1012, 'Tomas Reyes',         'Night Custodian',            'Facilities'),
  (1013, 'Gloria Featherstone', 'Day Custodian',              'Facilities'),
  (1014, 'Jasper Thorne',       'Security Officer',           'Facilities'),
  (1015, 'Bernard Okonkwo',     'Observatory Director',       'Administration'),
  (1016, 'Celeste Arden',       'Events Coordinator',         'Administration'),
  (1017, 'Nadia Volkova',       'IT Administrator',           'Administration'),
  (1018, 'Priya Desai',         'Gift Shop Clerk',            'Administration'),
  (1019, 'Priya Raman',         'Volunteer Docent',           'Volunteer Program'),
  (1020, 'Ezra Lindqvist',      'Volunteer Docent',           'Volunteer Program'),
  (1021, 'Beatrix Hollis',      'Volunteer Docent',           'Volunteer Program'),
  (1022, 'Noor Haddad',         'Volunteer Astrophotographer','Volunteer Program'),
  (1023, 'Maeve Donnelly',      'Donor',                      'Visitor'),
  (1024, 'Harold Ng',           'Donor',                      'Visitor'),
  (1025, 'Rosalind Achterberg', 'Board Member',               'Visitor'),
  (1026, 'Sofia Brandt',        'Science Journalist',         'Visitor'),
  (1027, 'Kwame Asante',        'High School Teacher',        'Visitor'),
  (1028, 'Dalia Ferreira',      'Software Engineer',          'Visitor'),
  (1029, 'Oliver Penrose',      'Retired Pilot',              'Visitor'),
  (1030, 'Yuki Tanabe',         'Amateur Astronomer',         'Visitor'),
  (1031, 'Amir Sadeghi',        'Catering Lead',              'Visitor'),
  (1032, 'Theo Okafor',         'Physics Undergraduate',      'Visitor');

-- ---------------------------------------------------------------------
-- Crime reports (12)
-- ---------------------------------------------------------------------
INSERT INTO crime_reports (id, occurred_at, location, type, description) VALUES
  (1, '2026-08-22 23:10', 'Pinecrest Planetarium - Projector Room', 'murder',
   'Projectionist found dead after a late show. A former employee was arrested on 2026-08-25. Case closed.'),
  (2, '2026-09-02 14:10', 'Larkspur Falls Public Library', 'theft',
   'A rare 1890s star atlas is missing from the reading room. No sign of forced entry.'),
  (3, '2026-09-19 22:45', 'Halvorsen Ridge Observatory - Parking Lot', 'vandalism',
   'Spray paint on the visitor shuttle. No witnesses; security cameras did not cover the lot.'),
  (4, '2026-10-03 03:15', 'Larkspur Falls Marina', 'burglary',
   'Two outboard motors taken from a locked boat shed.'),
  (5, '2026-10-11 15:30', 'Halvorsen Ridge Observatory - Gift Shop', 'theft',
   'Two meteorite paperweights missing after a school tour. Clerk suspects a shoplifter.'),
  (6, '2026-10-14 01:20', 'Larkspur Falls - Copper Kettle Diner', 'assault',
   'Argument over a booth turned into a shoving match. Both parties cited.'),
  (7, '2026-10-16 18:50', 'Halvorsen Ridge Observatory - Visitor Entrance', 'theft',
   'A guest reports her bicycle was taken from the rack while she checked in for the gala.'),
  (8, '2026-10-16 21:15', 'Route 9 Scenic Overlook', 'trespassing',
   'Group of teenagers found past the gate after closing. Sent home with a warning.'),
  (9, '2026-10-17 00:40', 'Halvorsen Ridge Observatory - West Dome', 'murder',
   'Dr. Imogen Varga was found dead at the foot of the catwalk stairs inside the West Dome at 00:35; police were called at 00:40. Head injury. A brass counterweight from the telescope mount lay beside her. The medical examiner puts the time of death between 23:45 and 00:05. Her laptop was on the desk; no external drive was found. Two witnesses gave statements: the night custodian, who found her, and a volunteer docent named Priya who walked the dome corridor late in the evening.'),
  (10, '2026-10-17 02:05', 'Larkspur Falls - Main Street', 'vandalism',
   'Shop window cracked outside the hardware store. Probably a thrown rock.'),
  (11, '2026-10-17 10:15', 'Halvorsen Ridge Observatory - Astrophysics Offices', 'theft',
   'The department chair reports that Dr. Imogen Varga''s external data drive, labelled "C/2026 K3 spectra", is missing. It was not found at the scene or in her office.'),
  (12, '2026-10-18 13:00', 'Larkspur Falls - Farmers Market', 'fraud',
   'Vendor paid with three counterfeit twenty-dollar bills.');

-- ---------------------------------------------------------------------
-- Interviews (18) — all recorded the morning after
-- ---------------------------------------------------------------------
INSERT INTO interviews (id, person_id, recorded_at, transcript) VALUES
  (1, 1012, '2026-10-17 01:05',
   'I was mopping the dome corridor from about half past eleven. At 23:51 somebody came out of the West Dome door in a hurry, hood up, carrying one of those long black hard cases from the equipment loan desk. I saw a red lanyard swinging, so it was staff, not a volunteer or a guest. I never saw a face. That door had been beeping all evening, too. Felt like the same person kept coming back. At 00:35 I went in to lock up and found Dr. Varga at the bottom of the stairs.'),
  (2, 1019, '2026-10-17 01:20',
   'My last East Dome tour finished just after half eleven. Walking down the corridor around 23:40 I heard Dr. Varga in the West Dome, really angry. She said "Those are my spectra and you know it." A man answered that the paper was already submitted and she could not prove a thing. I did not want to intrude, so I went up to the Roof Deck for the meteor watch.'),
  (3, 1020, '2026-10-17 01:40',
   'Around quarter to midnight I ducked into the West Dome to grab the jacket I had left on the coat hook. Dr. Varga was up on the catwalk with someone in a dark hoodie. Red lanyard, and a long black case on the floor at their feet. She snapped at me to go, so I grabbed my jacket and went up to the roof.'),
  (4, 1009, '2026-10-17 02:00',
   'I was fixing the West Dome shutter motor from a quarter past eleven. Dr. Varga was at her laptop the whole time, perfectly fine. Around 23:20 the door opened, someone looked in, saw me, and left without a word. I did not get a look at them. I finished at 23:24 and went to the staff lounge.'),
  (5, 1003, '2026-10-17 02:15',
   'I returned the star tracker mount to the loan lockers at 23:19, then dropped printed star charts on Imogen''s desk at about 23:35. She had her external drive plugged in and said she was waiting for someone. I was in and out in three minutes and went straight to the Roof Deck.'),
  (6, 1006, '2026-10-17 02:30',
   'I was at the gala until about half past eleven, then I went straight up to the Roof Deck for the meteor watch. I did not go near the West Dome all night. I did borrow a portable spectrograph earlier to check its calibration for Monday, but I returned it. Imogen and I had a great working relationship.'),
  (7, 1005, '2026-10-17 02:45',
   'I stayed at the gala until about 23:40, then went up to the roof. Imogen had been tense all week. Something about one of her datasets turning up where it should not have.'),
  (8, 1022, '2026-10-17 03:00',
   'I was on the Roof Deck from about 22:30 with the 600mm lens, shooting the meteor shower. I did not come down until after midnight. I returned the lens at 00:25 on my way out.'),
  (9, 1008, '2026-10-17 03:10',
   'I borrowed the solar telescope at 21:20 for a demo in the East Dome and completely forgot to return it. It is still in my locker in the grad office. I was up on the roof from 23:35 watching meteors with everyone else.'),
  (10, 1014, '2026-10-17 03:30',
   'Every badge door logs both directions, in and out, and the clocks are synced to the minute. Staff wear red lanyards. Volunteer Program people wear blue. Visitors do not get badges at all; they take the public stairs. The dome corridor camera was down for maintenance all week, sorry.'),
  (11, 1016, '2026-10-17 03:45',
   'Everyone scans in at the kiosk when they arrive, so check-ins are solid. Check-outs are optional and most people just drift off, so do not read much into a missing one. The meteor watch had its own kiosk on the Roof Deck, opening at 23:45.'),
  (12, 1002, '2026-10-17 09:30',
   'On Friday afternoon Imogen showed me a paper that had just been submitted to a journal. It used her comet spectra, C/2026 K3, practically line for line, under the name of a postdoc in her own group. She was going to file a misconduct complaint on Monday. She kept the raw data on an external drive she carried everywhere. Now the drive is gone.'),
  (13, 1010, '2026-10-17 10:05',
   'After 22:00 the loan desk runs on self-service lockers. You badge in, take the item, and the system logs it. This morning I checked a portable spectrograph that came back at 07:58. Someone had cut the foam insert out of one corner of the case, like they needed room for something small. A drive, maybe.'),
  (14, 1026, '2026-10-17 10:40',
   'I interviewed Dr. Varga at the gala around 21:40. Off the record she told me she would have "big news about integrity in science" next week. She seemed angry more than excited.'),
  (15, 1018, '2026-10-17 11:00',
   'I closed the gift shop at 21:00 and went home. I think you want the other Priya. She was giving dome tours.'),
  (16, 1013, '2026-10-17 11:15',
   'I work days. I left at five; Tomas had the night shift.'),
  (17, 1023, '2026-10-17 11:30',
   'A lovely evening. Harold and I left together around half past ten. We did not see anything unusual.'),
  (18, 1015, '2026-10-17 11:45',
   'I gave the donor toast at nine and left a little after eleven. Imogen was our best astronomer. I cannot believe it.');

-- ---------------------------------------------------------------------
-- Access logs (102)
-- ---------------------------------------------------------------------
INSERT INTO access_logs (id, person_id, location, direction, accessed_at) VALUES
  -- Thursday 15 October: an ordinary day
  ( 1, 1013, 'Staff Entrance', 'in',  '2026-10-15 07:00'),
  ( 2, 1004, 'Staff Entrance', 'in',  '2026-10-15 08:55'),
  ( 3, 1001, 'Staff Entrance', 'in',  '2026-10-15 09:20'),
  ( 4, 1006, 'Staff Entrance', 'in',  '2026-10-15 10:02'),
  ( 5, 1004, 'West Dome',      'in',  '2026-10-15 13:05'),
  ( 6, 1004, 'West Dome',      'out', '2026-10-15 15:40'),
  ( 7, 1001, 'West Dome',      'in',  '2026-10-15 20:50'),
  ( 8, 1001, 'West Dome',      'out', '2026-10-15 23:45'),
  -- (ids 99-102 were added later to log Thursday's exits; ids never change)
  (99,  1013, 'Staff Entrance', 'out', '2026-10-15 15:05'),
  (100, 1004, 'Staff Entrance', 'out', '2026-10-15 17:10'),
  (101, 1006, 'Staff Entrance', 'out', '2026-10-15 18:30'),
  (102, 1001, 'Staff Entrance', 'out', '2026-10-15 23:52'),
  -- Friday 16 October: daytime
  ( 9, 1013, 'Staff Entrance', 'in',  '2026-10-16 07:02'),
  (10, 1010, 'Staff Entrance', 'in',  '2026-10-16 08:30'),
  (11, 1002, 'Staff Entrance', 'in',  '2026-10-16 09:15'),
  (12, 1018, 'Staff Entrance', 'in',  '2026-10-16 10:00'),
  (13, 1011, 'Staff Entrance', 'in',  '2026-10-16 15:00'),
  (14, 1016, 'Staff Entrance', 'in',  '2026-10-16 16:00'),
  (15, 1009, 'Staff Entrance', 'in',  '2026-10-16 16:30'),
  (16, 1013, 'Staff Entrance', 'out', '2026-10-16 17:05'),
  (17, 1001, 'Staff Entrance', 'in',  '2026-10-16 17:48'),
  (18, 1014, 'Staff Entrance', 'in',  '2026-10-16 17:55'),
  (19, 1015, 'Staff Entrance', 'in',  '2026-10-16 18:00'),
  (20, 1004, 'Staff Entrance', 'in',  '2026-10-16 18:05'),
  (21, 1003, 'Staff Entrance', 'in',  '2026-10-16 18:20'),
  (22, 1019, 'Staff Entrance', 'in',  '2026-10-16 18:30'),
  (23, 1017, 'Staff Entrance', 'in',  '2026-10-16 18:30'),
  (24, 1020, 'Staff Entrance', 'in',  '2026-10-16 18:35'),
  (25, 1006, 'Staff Entrance', 'in',  '2026-10-16 18:40'),
  (26, 1005, 'Staff Entrance', 'in',  '2026-10-16 18:45'),
  (27, 1021, 'Staff Entrance', 'in',  '2026-10-16 18:50'),
  (28, 1008, 'Staff Entrance', 'in',  '2026-10-16 19:00'),
  (29, 1007, 'Staff Entrance', 'in',  '2026-10-16 19:10'),
  -- Friday evening: domes, lounge and roof
  (30, 1019, 'East Dome',      'in',  '2026-10-16 19:30'),
  (31, 1004, 'West Dome',      'in',  '2026-10-16 19:40'),
  (32, 1022, 'Staff Entrance', 'in',  '2026-10-16 19:50'),
  (33, 1019, 'East Dome',      'out', '2026-10-16 20:15'),
  (34, 1020, 'East Dome',      'in',  '2026-10-16 20:20'),
  (35, 1004, 'West Dome',      'out', '2026-10-16 20:30'),
  (36, 1017, 'Staff Lounge',   'in',  '2026-10-16 21:00'),
  (37, 1001, 'West Dome',      'in',  '2026-10-16 21:02'),
  (38, 1018, 'Staff Entrance', 'out', '2026-10-16 21:05'),
  (39, 1020, 'East Dome',      'out', '2026-10-16 21:10'),
  (40, 1021, 'East Dome',      'in',  '2026-10-16 21:15'),
  (41, 1008, 'East Dome',      'in',  '2026-10-16 21:30'),
  (42, 1001, 'West Dome',      'out', '2026-10-16 21:31'),
  (43, 1017, 'Staff Lounge',   'out', '2026-10-16 21:40'),
  (44, 1012, 'Staff Entrance', 'in',  '2026-10-16 22:00'),
  (45, 1010, 'Staff Entrance', 'out', '2026-10-16 22:05'),
  (46, 1017, 'Staff Entrance', 'out', '2026-10-16 22:15'),
  (47, 1002, 'Staff Entrance', 'out', '2026-10-16 22:20'),
  (48, 1022, 'Roof Deck',      'in',  '2026-10-16 22:28'),
  (49, 1008, 'East Dome',      'out', '2026-10-16 22:30'),
  (50, 1004, 'Staff Entrance', 'out', '2026-10-16 22:40'),
  (51, 1006, 'West Dome',      'in',  '2026-10-16 22:41'),
  (52, 1021, 'East Dome',      'out', '2026-10-16 22:45'),
  (53, 1006, 'West Dome',      'out', '2026-10-16 22:47'),
  (54, 1019, 'East Dome',      'in',  '2026-10-16 22:50'),
  (55, 1021, 'Staff Entrance', 'out', '2026-10-16 22:55'),
  (56, 1011, 'Staff Lounge',   'in',  '2026-10-16 23:00'),
  (57, 1001, 'West Dome',      'in',  '2026-10-16 23:05'),
  (58, 1012, 'Staff Lounge',   'in',  '2026-10-16 23:10'),
  (59, 1009, 'West Dome',      'in',  '2026-10-16 23:15'),
  (60, 1015, 'Staff Entrance', 'out', '2026-10-16 23:15'),
  (61, 1006, 'West Dome',      'in',  '2026-10-16 23:20'),
  (62, 1006, 'West Dome',      'out', '2026-10-16 23:21'),
  (63, 1009, 'West Dome',      'out', '2026-10-16 23:24'),
  (64, 1012, 'Staff Lounge',   'out', '2026-10-16 23:28'),
  (65, 1009, 'Staff Lounge',   'in',  '2026-10-16 23:30'),
  (66, 1003, 'West Dome',      'in',  '2026-10-16 23:33'),
  (67, 1008, 'Roof Deck',      'in',  '2026-10-16 23:35'),
  (68, 1011, 'Staff Lounge',   'out', '2026-10-16 23:35'),
  (69, 1003, 'West Dome',      'out', '2026-10-16 23:36'),
  (70, 1006, 'West Dome',      'in',  '2026-10-16 23:38'),
  (71, 1019, 'East Dome',      'out', '2026-10-16 23:38'),
  (72, 1016, 'Roof Deck',      'in',  '2026-10-16 23:40'),
  (73, 1011, 'Staff Entrance', 'out', '2026-10-16 23:40'),
  (74, 1003, 'Roof Deck',      'in',  '2026-10-16 23:41'),
  (75, 1005, 'Roof Deck',      'in',  '2026-10-16 23:43'),
  (76, 1019, 'Roof Deck',      'in',  '2026-10-16 23:44'),
  (77, 1020, 'West Dome',      'in',  '2026-10-16 23:44'),
  (78, 1007, 'Roof Deck',      'in',  '2026-10-16 23:46'),
  (79, 1020, 'West Dome',      'out', '2026-10-16 23:47'),
  (80, 1020, 'Roof Deck',      'in',  '2026-10-16 23:50'),
  (81, 1006, 'West Dome',      'out', '2026-10-16 23:51'),
  (82, 1006, 'Roof Deck',      'in',  '2026-10-16 23:57'),
  -- After midnight
  (83, 1009, 'Staff Lounge',   'out', '2026-10-17 00:05'),
  (84, 1009, 'Staff Entrance', 'out', '2026-10-17 00:10'),
  (85, 1022, 'Roof Deck',      'out', '2026-10-17 00:20'),
  (86, 1012, 'West Dome',      'in',  '2026-10-17 00:35'),
  (87, 1022, 'Staff Entrance', 'out', '2026-10-17 00:40'),
  (88, 1007, 'Roof Deck',      'out', '2026-10-17 00:45'),
  (89, 1020, 'Roof Deck',      'out', '2026-10-17 00:48'),
  (90, 1003, 'Roof Deck',      'out', '2026-10-17 00:50'),
  (91, 1019, 'Roof Deck',      'out', '2026-10-17 00:50'),
  (92, 1005, 'Roof Deck',      'out', '2026-10-17 00:55'),
  (93, 1008, 'Roof Deck',      'out', '2026-10-17 01:00'),
  (94, 1006, 'Roof Deck',      'out', '2026-10-17 01:05'),
  (95, 1016, 'Roof Deck',      'out', '2026-10-17 01:10'),
  (96, 1006, 'Staff Entrance', 'out', '2026-10-17 01:12'),
  -- Saturday morning
  (97, 1006, 'Staff Entrance', 'in',  '2026-10-17 07:55'),
  (98, 1010, 'Staff Entrance', 'in',  '2026-10-17 09:50');

-- ---------------------------------------------------------------------
-- Equipment loans (18)
-- ---------------------------------------------------------------------
INSERT INTO equipment_loans (id, person_id, item_name, borrowed_at, returned_at) VALUES
  ( 1, 1002, 'Loaner laptop',                                  '2026-10-09 10:00', '2026-10-12 16:30'),
  ( 2, 1001, 'Portable spectrograph (long hard case)',         '2026-10-12 20:00', '2026-10-14 09:00'),
  ( 3, 1005, 'Loaner laptop',                                  '2026-10-14 11:00', '2026-10-16 17:00'),
  ( 4, 1004, '80mm refractor telescope (long hard case)',      '2026-10-15 12:50', '2026-10-16 09:10'),
  ( 5, 1013, 'Floor buffer',                                   '2026-10-16 07:10', '2026-10-16 11:30'),
  ( 6, 1016, 'Ticket scanner kiosk',                           '2026-10-16 15:50', '2026-10-17 01:15'),
  ( 7, 1017, 'Projector remote',                               '2026-10-16 18:35', '2026-10-16 21:00'),
  ( 8, 1020, 'Red LED flashlight',                             '2026-10-16 18:40', '2026-10-17 00:52'),
  ( 9, 1021, 'Planisphere teaching set (flat box)',            '2026-10-16 18:55', '2026-10-16 22:50'),
  (10, 1019, 'Green laser pointer',                            '2026-10-16 19:20', '2026-10-17 00:55'),
  (11, 1004, 'Spectral calibration lamp (small hard case)',    '2026-10-16 19:20', '2026-10-16 20:35'),
  (12, 1003, 'Star tracker mount (long hard case)',            '2026-10-16 19:30', '2026-10-16 23:19'),
  (13, 1022, '600mm telephoto lens (long hard case)',          '2026-10-16 20:10', '2026-10-17 00:25'),
  (14, 1008, 'Solar telescope (long hard case)',               '2026-10-16 21:20', NULL),
  (15, 1012, 'Wet-floor signs (set of 4)',                     '2026-10-16 22:05', NULL),
  (16, 1006, 'Portable spectrograph (long hard case)',         '2026-10-16 22:55', '2026-10-17 07:58'),
  (17, 1009, 'Torque wrench kit (small hard case)',            '2026-10-16 23:05', '2026-10-16 23:28'),
  (18, 1007, 'Binoculars 15x70',                               '2026-10-16 23:30', '2026-10-17 00:47');

-- ---------------------------------------------------------------------
-- Event attendance (40)
-- ---------------------------------------------------------------------
INSERT INTO event_attendance (id, person_id, event_name, location, checked_in_at, checked_out_at) VALUES
  -- Thursday members' lecture
  ( 1, 1001, 'Members Lecture: Comets Up Close', 'Main Hall', '2026-10-15 18:50', '2026-10-15 20:40'),
  ( 2, 1006, 'Members Lecture: Comets Up Close', 'Main Hall', '2026-10-15 19:00', '2026-10-15 20:35'),
  ( 3, 1026, 'Members Lecture: Comets Up Close', 'Main Hall', '2026-10-15 19:02', NULL),
  ( 4, 1030, 'Members Lecture: Comets Up Close', 'Main Hall', '2026-10-15 19:05', '2026-10-15 20:30'),
  ( 5, 1021, 'Members Lecture: Comets Up Close', 'Main Hall', '2026-10-15 19:10', '2026-10-15 20:40'),
  ( 6, 1024, 'Members Lecture: Comets Up Close', 'Main Hall', '2026-10-15 19:20', '2026-10-15 20:15'),
  -- Friday gala
  ( 7, 1031, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 18:30', NULL),
  ( 8, 1016, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 18:50', NULL),
  ( 9, 1017, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 18:52', '2026-10-16 22:10'),
  (10, 1015, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 18:58', '2026-10-16 23:10'),
  (11, 1002, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:00', '2026-10-16 22:15'),
  (12, 1001, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:01', '2026-10-16 22:58'),
  (13, 1004, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:03', '2026-10-16 22:35'),
  (14, 1003, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:05', NULL),
  (15, 1006, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:05', NULL),
  (16, 1008, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:06', '2026-10-16 21:18'),
  (17, 1005, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:10', '2026-10-16 23:40'),
  (18, 1023, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:12', '2026-10-16 22:30'),
  (19, 1024, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:14', '2026-10-16 22:31'),
  (20, 1007, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:15', NULL),
  (21, 1028, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:18', NULL),
  (22, 1025, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:20', '2026-10-16 23:05'),
  (23, 1029, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:22', '2026-10-16 22:00'),
  (24, 1026, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:25', NULL),
  (25, 1027, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:30', NULL),
  (26, 1030, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:35', NULL),
  (27, 1032, 'Autumn Star Party Gala', 'Main Hall', '2026-10-16 19:40', NULL),
  -- Friday meteor watch (kiosk opened at 23:45)
  (28, 1003, 'Midnight Meteor Watch', 'Roof Deck', '2026-10-16 23:45', '2026-10-17 00:49'),
  (29, 1019, 'Midnight Meteor Watch', 'Roof Deck', '2026-10-16 23:45', NULL),
  (30, 1005, 'Midnight Meteor Watch', 'Roof Deck', '2026-10-16 23:46', NULL),
  (31, 1008, 'Midnight Meteor Watch', 'Roof Deck', '2026-10-16 23:46', '2026-10-17 00:59'),
  (32, 1022, 'Midnight Meteor Watch', 'Roof Deck', '2026-10-16 23:46', '2026-10-17 00:19'),
  (33, 1007, 'Midnight Meteor Watch', 'Roof Deck', '2026-10-16 23:47', NULL),
  (34, 1030, 'Midnight Meteor Watch', 'Roof Deck', '2026-10-16 23:47', NULL),
  (35, 1027, 'Midnight Meteor Watch', 'Roof Deck', '2026-10-16 23:48', NULL),
  (36, 1032, 'Midnight Meteor Watch', 'Roof Deck', '2026-10-16 23:48', '2026-10-17 00:30'),
  (37, 1028, 'Midnight Meteor Watch', 'Roof Deck', '2026-10-16 23:49', NULL),
  (38, 1020, 'Midnight Meteor Watch', 'Roof Deck', '2026-10-16 23:51', NULL),
  (39, 1026, 'Midnight Meteor Watch', 'Roof Deck', '2026-10-16 23:53', NULL),
  (40, 1006, 'Midnight Meteor Watch', 'Roof Deck', '2026-10-16 23:58', NULL);
