-- =====================================================================
--  Level 3 · Cold Case: The Millrace Poisonings — evidence
--  Millrace Market Hall, Larkspur Falls (all fictional)
--
--  Plain, deterministic SQLite. Times are local, 24-hour TEXT in the form
--  'YYYY-MM-DD HH:MM', so text comparison sorts chronologically.
--
--  station_log only records when a stint STARTS. A stint ends when the
--  same person's next row starts (LEAD() rebuilds the end times). The last
--  row of each shift has station 'off'.
--
--  Background orders are generated with a recursive CTE so the hall looks
--  busy; every order that matters to the case is written out by hand.
-- =====================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE stalls (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL UNIQUE,
  cuisine  TEXT NOT NULL
);

CREATE TABLE staff (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  stall_id  INTEGER NOT NULL REFERENCES stalls(id),
  role      TEXT NOT NULL
);

-- Everyone who uses the hall's loyalty app. Every app order is logged.
CREATE TABLE customers (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE,
  loyalty_since  TEXT NOT NULL
);

CREATE TABLE orders (
  id           INTEGER PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  stall_id     INTEGER NOT NULL REFERENCES stalls(id),
  ordered_at   TEXT NOT NULL,
  item         TEXT NOT NULL,
  total        REAL NOT NULL
);

CREATE TABLE station_log (
  id          INTEGER PRIMARY KEY,
  staff_id    INTEGER NOT NULL REFERENCES staff(id),
  station     TEXT NOT NULL,      -- drinks, register, kitchen, counter, or off
  started_at  TEXT NOT NULL
);

CREATE TABLE illness_reports (
  id           INTEGER PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  onset_at     TEXT NOT NULL,
  diagnosis    TEXT NOT NULL,
  notes        TEXT NOT NULL
);

CREATE TABLE reviews (
  id           INTEGER PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  stall_id     INTEGER NOT NULL REFERENCES stalls(id),
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  posted_at    TEXT NOT NULL,
  comment      TEXT NOT NULL
);

INSERT INTO stalls (id, name, cuisine) VALUES
  (1, 'Copperline Coffee',   'coffee'),
  (2, 'Ferro Pizza',         'pizza'),
  (3, 'Ember & Oak Tea Bar', 'tea'),
  (4, 'The Dumpling Lab',    'dumplings'),
  (5, 'Morrow Bakery',       'bakery'),
  (6, 'Saltgrass Oysters',   'seafood');

INSERT INTO staff (id, name, stall_id, role) VALUES
  (1,  'Margo Ellery',  3, 'Owner'),
  (2,  'Dov Pereira',   3, 'Barista'),
  (3,  'Ines Calder',   3, 'Barista'),
  (4,  'Pip Langford',  3, 'Barista (part-time)'),
  (5,  'Sunny Okonkwo', 3, 'Kitchen hand'),
  (6,  'Theo Brandt',   1, 'Barista'),
  (7,  'Hazel Kim',     1, 'Manager'),
  (8,  'Marco Ferro',   2, 'Owner'),
  (9,  'Rosa Ibanez',   2, 'Cook'),
  (10, 'Lin Zhou',      4, 'Chef'),
  (11, 'Wilma Morrow',  5, 'Baker'),
  (12, 'Abe Salter',    6, 'Shucker');

INSERT INTO customers (id, name, loyalty_since) VALUES
  (1,  'Agnes Whitford', '2025-03-14'),
  (2,  'Bernard Lusk',   '2025-06-02'),
  (3,  'Celia Moon',     '2024-11-20'),
  (4,  'Desmond Achebe', '2025-08-09'),
  (5,  'Fern Ostrova',   '2026-01-17'),
  (6,  'Beatrix Coyle',  '2025-12-01'),
  (7,  'Hugo Varela',    '2025-04-22'),
  (8,  'Ivy Thackeray',  '2024-09-30'),
  (9,  'Jonah Pell',     '2025-02-11'),
  (10, 'Kit Danvers',    '2025-05-05'),
  (11, 'Leon Asher',     '2026-02-28'),
  (12, 'Mina Sorel',     '2025-07-19'),
  (13, 'Nico Ambrose',   '2024-12-12'),
  (14, 'Orla Finnegan',  '2025-10-03'),
  (15, 'Pavel Novak',    '2025-01-08'),
  (16, 'Quinn Hartley',  '2026-03-21'),
  (17, 'Rhea Castell',   '2025-09-14'),
  (18, 'Saul Mendes',    '2024-10-27'),
  (19, 'Tess Ogilvy',    '2025-11-11'),
  (20, 'Umar Rashid',    '2026-04-02'),
  (21, 'Vivian Locke',   '2025-03-30'),
  (22, 'Wade Kessler',   '2024-08-18'),
  (23, 'Yara Haddad',    '2025-06-25'),
  (24, 'Zeke Morrell',   '2026-05-09'),
  (25, 'Alma Rook',      '2025-02-14'),
  (26, 'Basil Tran',     '2024-07-07'),
  (27, 'Cora Lind',      '2025-08-30'),
  (28, 'Dario Venn',     '2026-06-15'),
  (29, 'Elsie Prior',    '2025-04-04'),
  (30, 'Fitz Gerrard',   '2025-12-24');

-- Orders that matter: the five patients, plus Beatrix and Hugo.
INSERT INTO orders (id, customer_id, stall_id, ordered_at, item, total) VALUES
  (1,  1, 3, '2026-09-01 10:00', 'matcha',          4.90),
  (2,  1, 2, '2026-09-03 19:10', 'margherita',     11.00),
  (3,  1, 1, '2026-09-04 08:40', 'flat white',      3.80),
  (4,  1, 3, '2026-09-04 09:12', 'smoked chai',     4.50),
  (5,  3, 3, '2026-09-06 15:00', 'oolong pot',      5.20),
  (6,  2, 4, '2026-09-07 12:30', 'pork dumplings',  9.50),
  (7,  2, 1, '2026-09-08 10:05', 'cortado',         3.40),
  (8,  2, 3, '2026-09-08 14:40', 'oolong pot',      5.20),
  (9,  5, 1, '2026-09-10 08:30', 'flat white',      3.80),
  (10, 7, 4, '2026-09-11 12:10', 'pork dumplings',  9.50),
  (11, 3, 1, '2026-09-12 09:20', 'latte',           4.00),
  (12, 3, 3, '2026-09-13 11:05', 'masala chai',     4.50),
  (13, 3, 2, '2026-09-13 18:45', 'diavola',        12.50),
  (14, 4, 1, '2026-09-17 08:15', 'espresso',        2.60),
  (15, 4, 5, '2026-09-18 08:50', 'cardamom bun',    3.20),
  (16, 4, 3, '2026-09-18 16:20', 'earl grey latte', 4.80),
  (17, 6, 3, '2026-09-21 13:15', 'scone',           3.50),
  (18, 5, 2, '2026-09-22 20:00', 'margherita',     11.00),
  (19, 5, 5, '2026-09-23 09:30', 'sourdough loaf',  6.00),
  (20, 5, 3, '2026-09-23 10:35', 'smoked chai',     4.50),
  (21, 7, 3, '2026-09-24 15:40', 'earl grey latte', 4.80),
  (22, 6, 1, '2026-09-25 08:05', 'latte',           4.00);

-- Background orders from the other regulars (customers 8-30), ids 101-270.
INSERT INTO orders (id, customer_id, stall_id, ordered_at, item, total)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 170),
shaped AS (
  SELECT n,
         8 + (n * 7) % 23 AS customer_id,
         1 + (n * 5) % 6  AS stall_id,
         printf('2026-09-%02d %02d:%02d', 1 + (n * 11) % 28, 8 + (n * 3) % 11, (n * 17) % 60) AS ordered_at
  FROM seq
)
SELECT 100 + n, customer_id, stall_id, ordered_at,
       CASE stall_id
         WHEN 1 THEN CASE n % 3 WHEN 0 THEN 'flat white' WHEN 1 THEN 'latte' ELSE 'espresso' END
         WHEN 2 THEN CASE n % 2 WHEN 0 THEN 'margherita' ELSE 'diavola' END
         WHEN 3 THEN CASE n % 4 WHEN 0 THEN 'smoked chai' WHEN 1 THEN 'matcha' WHEN 2 THEN 'oolong pot' ELSE 'scone' END
         WHEN 4 THEN CASE n % 2 WHEN 0 THEN 'pork dumplings' ELSE 'veg dumplings' END
         WHEN 5 THEN CASE n % 3 WHEN 0 THEN 'cardamom bun' WHEN 1 THEN 'croissant' ELSE 'sourdough loaf' END
         ELSE CASE n % 2 WHEN 0 THEN 'half dozen oysters' ELSE 'fish soup' END
       END,
       CASE stall_id WHEN 1 THEN 3.80 WHEN 2 THEN 11.50 WHEN 3 THEN 4.60 WHEN 4 THEN 9.00 WHEN 5 THEN 3.90 ELSE 14.00 END
FROM shaped;

-- Ember & Oak (staff 1-5) and Copperline (staff 6-7) shifts.
INSERT INTO station_log (id, staff_id, station, started_at) VALUES
  -- Thursday 4 September
  (1,  1, 'register', '2026-09-04 07:00'),
  (2,  1, 'drinks',   '2026-09-04 08:30'),
  (3,  1, 'register', '2026-09-04 12:00'),
  (4,  1, 'off',      '2026-09-04 15:00'),
  (5,  2, 'drinks',   '2026-09-04 07:00'),
  (6,  2, 'register', '2026-09-04 08:30'),
  (7,  2, 'drinks',   '2026-09-04 12:00'),
  (8,  2, 'off',      '2026-09-04 15:00'),
  (9,  3, 'kitchen',  '2026-09-04 07:00'),
  (10, 3, 'off',      '2026-09-04 13:00'),
  (11, 5, 'kitchen',  '2026-09-04 12:00'),
  (12, 5, 'off',      '2026-09-04 18:00'),
  (13, 6, 'counter',  '2026-09-04 07:00'),
  (14, 6, 'off',      '2026-09-04 15:00'),
  (15, 7, 'counter',  '2026-09-04 11:00'),
  (16, 7, 'off',      '2026-09-04 18:00'),
  -- Saturday 6 September
  (17, 1, 'drinks',   '2026-09-06 07:00'),
  (18, 1, 'off',      '2026-09-06 14:00'),
  (19, 3, 'register', '2026-09-06 07:00'),
  (20, 3, 'off',      '2026-09-06 14:00'),
  (21, 4, 'kitchen',  '2026-09-06 10:00'),
  (22, 4, 'off',      '2026-09-06 16:00'),
  -- Monday 8 September
  (23, 4, 'drinks',   '2026-09-08 07:00'),
  (24, 4, 'off',      '2026-09-08 10:00'),
  (25, 1, 'register', '2026-09-08 10:00'),
  (26, 1, 'drinks',   '2026-09-08 13:30'),
  (27, 1, 'off',      '2026-09-08 18:00'),
  (28, 2, 'kitchen',  '2026-09-08 10:00'),
  (29, 2, 'off',      '2026-09-08 16:00'),
  (30, 5, 'drinks',   '2026-09-08 10:00'),
  (31, 5, 'register', '2026-09-08 13:30'),
  (32, 5, 'off',      '2026-09-08 18:00'),
  (33, 6, 'counter',  '2026-09-08 07:00'),
  (34, 6, 'off',      '2026-09-08 15:00'),
  (35, 7, 'counter',  '2026-09-08 11:00'),
  (36, 7, 'off',      '2026-09-08 18:00'),
  -- Saturday 13 September
  (37, 1, 'drinks',   '2026-09-13 07:00'),
  (38, 1, 'register', '2026-09-13 12:30'),
  (39, 1, 'off',      '2026-09-13 15:00'),
  (40, 2, 'register', '2026-09-13 07:00'),
  (41, 2, 'drinks',   '2026-09-13 10:00'),
  (42, 2, 'off',      '2026-09-13 15:00'),
  (43, 3, 'kitchen',  '2026-09-13 07:00'),
  (44, 3, 'register', '2026-09-13 10:00'),
  (45, 3, 'off',      '2026-09-13 15:00'),
  (46, 4, 'drinks',   '2026-09-13 12:00'),
  (47, 4, 'off',      '2026-09-13 18:00'),
  (48, 6, 'counter',  '2026-09-13 07:00'),
  (49, 6, 'off',      '2026-09-13 15:00'),
  (50, 7, 'counter',  '2026-09-13 11:00'),
  (51, 7, 'off',      '2026-09-13 18:00'),
  -- Monday 15 September
  (52, 2, 'drinks',   '2026-09-15 07:00'),
  (53, 2, 'off',      '2026-09-15 15:00'),
  (54, 5, 'register', '2026-09-15 07:00'),
  (55, 5, 'off',      '2026-09-15 15:00'),
  (56, 1, 'register', '2026-09-15 11:00'),
  (57, 1, 'off',      '2026-09-15 18:00'),
  -- Thursday 18 September
  (58, 1, 'register', '2026-09-18 11:00'),
  (59, 1, 'drinks',   '2026-09-18 14:00'),
  (60, 1, 'off',      '2026-09-18 18:00'),
  (61, 2, 'drinks',   '2026-09-18 11:00'),
  (62, 2, 'register', '2026-09-18 14:00'),
  (63, 2, 'off',      '2026-09-18 18:00'),
  (64, 3, 'kitchen',  '2026-09-18 12:00'),
  (65, 3, 'off',      '2026-09-18 18:00'),
  (66, 4, 'kitchen',  '2026-09-18 11:00'),
  (67, 4, 'drinks',   '2026-09-18 15:00'),
  (68, 4, 'off',      '2026-09-18 18:00'),
  (69, 6, 'counter',  '2026-09-18 07:00'),
  (70, 6, 'off',      '2026-09-18 15:00'),
  (71, 7, 'counter',  '2026-09-18 11:00'),
  (72, 7, 'off',      '2026-09-18 18:00'),
  -- Tuesday 23 September
  (73, 1, 'register', '2026-09-23 07:00'),
  (74, 1, 'drinks',   '2026-09-23 09:45'),
  (75, 1, 'off',      '2026-09-23 13:00'),
  (76, 2, 'drinks',   '2026-09-23 07:00'),
  (77, 2, 'off',      '2026-09-23 13:00'),
  (78, 3, 'kitchen',  '2026-09-23 07:00'),
  (79, 3, 'off',      '2026-09-23 13:00'),
  (80, 5, 'register', '2026-09-23 09:00'),
  (81, 5, 'off',      '2026-09-23 17:00'),
  (82, 6, 'counter',  '2026-09-23 07:00'),
  (83, 6, 'off',      '2026-09-23 15:00'),
  (84, 7, 'counter',  '2026-09-23 11:00'),
  (85, 7, 'off',      '2026-09-23 18:00');

INSERT INTO illness_reports (id, customer_id, onset_at, diagnosis, notes) VALUES
  (1,  9,  '2026-09-02 22:00', 'norovirus',
   'Vomiting after a family party. Three relatives ill too.'),
  (2,  1,  '2026-09-05 06:30', 'thallium poisoning',
   'Severe stomach pain, then tingling in both feet. Thallium in blood and urine. Patient says she had "a smoky tea" at the Millrace Market Hall the day before.'),
  (3,  2,  '2026-09-09 08:15', 'thallium poisoning',
   'Abdominal pain and numb hands. Thallium confirmed. Recalls a pot of tea at the market hall: "bitter, but I drank it all".'),
  (4,  7,  '2026-09-11 13:20', 'allergic reaction',
   'Peanut allergy. Reacted to a dipping sauce. Discharged the same day.'),
  (5,  3,  '2026-09-14 05:50', 'thallium poisoning',
   'Nerve pain in both legs, hair starting to fall out. Toxicology: thallium salts are tasteless and dissolve easily in hot drinks.'),
  (6,  15, '2026-09-16 19:00', 'food poisoning (salmonella)',
   'Ate undercooked chicken at a barbecue.'),
  (7,  4,  '2026-09-19 07:40', 'thallium poisoning',
   'Thallium confirmed. Drank a hot tea latte the afternoon before.'),
  (8,  12, '2026-09-21 03:10', 'norovirus',
   'Outbreak at her office. Six colleagues ill.'),
  (9,  5,  '2026-09-24 09:05', 'thallium poisoning',
   'Thallium confirmed. Fifth case this month. Police notified. All five patients use the market hall loyalty app.'),
  (10, 20, '2026-09-25 14:00', 'food poisoning (salmonella)',
   'Raw egg in a home-made dessert.');

INSERT INTO reviews (id, customer_id, stall_id, rating, posted_at, comment) VALUES
  (1,  8,  3, 5, '2026-08-03', 'Best smoked chai in town. Cosy little corner.'),
  (2,  26, 1, 4, '2026-08-05', 'Reliable flat white, quick service.'),
  (3,  7,  3, 1, '2026-08-12', 'I asked whether the scones had nuts and the owner rolled her eyes. Never again.'),
  (4,  13, 2, 5, '2026-08-14', 'Proper wood-fired crust.'),
  (5,  1,  3, 1, '2026-08-20', 'Lukewarm chai, and the owner argued with me when I sent it back.'),
  (6,  22, 2, 1, '2026-08-22', 'Burnt base, cold toppings. Disappointing.'),
  (7,  17, 4, 5, '2026-08-24', 'The pork dumplings are worth the queue.'),
  (8,  14, 3, 2, '2026-08-26', 'Nice tea, very slow. They seemed short-staffed.'),
  (9,  2,  3, 1, '2026-08-29', 'Waited 25 minutes for a pot of tea. The owner told me to go somewhere else if I was in a hurry. I will.'),
  (10, 1,  1, 5, '2026-08-30', 'Lovely staff, always remember my order.'),
  (11, 19, 5, 5, '2026-09-01', 'Cardamom buns sell out by ten for a reason.'),
  (12, 10, 3, 4, '2026-09-02', 'Good matcha, a bit pricey.'),
  (13, 15, 6, 2, '2026-09-03', 'Oysters fine, fish soup salty.'),
  (14, 3,  3, 1, '2026-09-07', 'Overpriced and rude. The smoked chai tasted like an ashtray.'),
  (15, 25, 3, 5, '2026-09-08', 'Margo knows her teas. Ask her for a recommendation.'),
  (16, 3,  2, 4, '2026-09-09', 'Great diavola.'),
  (17, 21, 1, 4, '2026-09-11', 'Solid coffee, nice view of the river.'),
  (18, 4,  3, 1, '2026-09-14', 'The owner shouted at a teenager for spilling milk. Awful atmosphere.'),
  (19, 28, 4, 4, '2026-09-15', 'Veg dumplings were excellent.'),
  (20, 11, 6, 5, '2026-09-16', 'Fresh and briny, just right.'),
  (21, 5,  3, 1, '2026-09-19', 'Avoid. The owner glared at me the whole time I was there.'),
  (22, 30, 5, 3, '2026-09-20', 'Croissant was fine. Nothing special.'),
  (23, 6,  3, 1, '2026-09-22', 'My scone was stale and nobody cared. One star is generous.'),
  (24, 24, 1, 2, '2026-09-23', 'Espresso was sour today.'),
  (25, 16, 3, 4, '2026-09-24', 'Pretty cups, decent oolong.'),
  (26, 2,  4, 5, '2026-09-26', 'The dumplings cheered me up after a rough month.');
