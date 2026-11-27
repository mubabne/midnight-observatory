-- =====================================================================
--  Level 1 · The Academy — training data
--  Larkspur Falls Police Academy (all fictional)
--
--  One table on purpose: beginners learn SELECT, WHERE, LIKE, NULL,
--  ORDER BY, LIMIT, DISTINCT and COUNT before they ever need a JOIN.
--  Every age and every height is different, so ORDER BY never ties.
--  The final lesson's witness description fits exactly one row.
-- =====================================================================

CREATE TABLE suspects (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  age           INTEGER NOT NULL,
  height_cm     INTEGER NOT NULL,
  hair          TEXT NOT NULL,
  neighborhood  TEXT NOT NULL,
  occupation    TEXT NOT NULL,
  vehicle       TEXT NOT NULL,
  alibi         TEXT            -- NULL when nobody has checked an alibi yet
);

INSERT INTO suspects (id, name, age, height_cm, hair, neighborhood, occupation, vehicle, alibi) VALUES
  (1,  'Ada Okafor',       34, 168, 'black', 'Riverside', 'Librarian',        'blue hatchback',  'Working the late shift at the library'),
  (2,  'Bram Hollis',      52, 191, 'red',   'Northside', 'Locksmith',        'green hatchback', 'Playing cards at the Fox & Fiddle'),
  (3,  'Cleo Marsh',       27, 162, 'red',   'Northside', 'Florist',          'dark green van',  NULL),
  (4,  'Dmitri Volkov',    45, 188, 'red',   'Harbor',    'Fisherman',        'silver sedan',    NULL),
  (5,  'Esme Laurent',     23, 171, 'blond', 'Old Town',  'Barista',          'bicycle',         'Closing up Copperline Coffee'),
  (6,  'Felix Nakamura',   61, 175, 'grey',  'Hilltop',   'Retired teacher',  'white van',       'Watching a film with his sister'),
  (7,  'Gus Pemberton',    38, 186, 'black', 'Northside', 'Delivery driver',  'green scooter',   NULL),
  (8,  'Hana Lindgren',    29, 166, 'brown', 'Riverside', 'Nurse',            'red pickup',      'On shift at Larkspur General'),
  (9,  'Rory Calloway',    47, 183, 'red',   'Old Town',  'Butcher',          'green pickup',    NULL),
  (10, 'Juno Abara',       19, 158, 'black', 'Harbor',    'Student',          'bicycle',         'Studying at a friend''s flat'),
  (11, 'Kasper Wright',    56, 179, 'red',   'Northside', 'Postal worker',    'green hatchback', NULL),
  (12, 'Lila Moreau',      33, 170, 'brown', 'Hilltop',   'Accountant',       'black SUV',       'At her book club'),
  (13, 'Mateo Ruiz',       41, 184, 'brown', 'Riverside', 'Electrician',      'dark green van',  NULL),
  (14, 'Nell Fairweather', 68, 160, 'grey',  'Old Town',  'Retired baker',    'bicycle',         'Asleep; a neighbour heard her radio'),
  (15, 'Oscar Pike',       25, 189, 'blond', 'Northside', 'Mechanic',         'red pickup',      'Fixing a car at Northside Garage'),
  (16, 'Petra Kowal',      36, 173, 'red',   'Riverside', 'Hairdresser',      'blue hatchback',  'At her sister''s wedding'),
  (17, 'Quentin Shaw',     59, 181, 'black', 'Hilltop',   'Banker',           'black SUV',       'Dinner at the Hilltop Grill'),
  (18, 'Rosa Delgado',     30, 165, 'black', 'Harbor',    'Dock worker',      'white van',       NULL),
  (19, 'Silas Grant',      44, 187, 'grey',  'Old Town',  'Antique dealer',   'silver sedan',    'At an auction in Millbrook'),
  (20, 'Tilly Brooks',     21, 169, 'blond', 'Northside', 'Cashier',          'green scooter',   'Babysitting her cousins'),
  (21, 'Ulric Stone',      63, 177, 'grey',  'Harbor',    'Ferry captain',    'white van',       'Working the night ferry'),
  (22, 'Vera Quinn',       28, 172, 'red',   'Old Town',  'Painter',          'bicycle',         'At a gallery opening'),
  (23, 'Wes Harlow',       50, 190, 'brown', 'Hilltop',   'Builder',          'red pickup',      'Watching football at home'),
  (24, 'Xena Park',        39, 164, 'black', 'Riverside', 'Pharmacist',       'silver sedan',    'Working at Riverside Pharmacy'),
  (25, 'Yusuf Demir',      26, 178, 'black', 'Old Town',  'Chef',             'blue hatchback',  'Cooking at the Saltgrass restaurant'),
  (26, 'Zara Whitlock',    42, 167, 'blond', 'Harbor',    'Journalist',       'black SUV',       NULL),
  (27, 'Abel Fenn',        24, 182, 'red',   'Northside', 'Student',          'bicycle',         'At a concert in the park'),
  (28, 'Bea Sorensen',     55, 163, 'brown', 'Old Town',  'Tailor',           'silver sedan',    'Sewing at home with the radio on'),
  (29, 'Cyrus Webb',       31, 185, 'blond', 'Hilltop',   'Personal trainer', 'black SUV',       'At the gym until midnight'),
  (30, 'Dora Finch',       48, 161, 'grey',  'Northside', 'Cake decorator',   'white van',       'Finishing a wedding cake at home');
