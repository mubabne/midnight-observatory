-- =====================================================================
--  Level 4 · Tampered Evidence — the archive's security database
--  Larkspur Falls City Archive (all fictional)
--
--  This file is the NIGHTLY BACKUP taken at 2026-10-22 01:00. It is a
--  template: {{db}} becomes "main" for the live database and "backup" for
--  the copy attached as a read-only reference. tamper.sql then runs on
--  main only, replaying what happened after the backup was taken.
--
--  The admin console stamps modified_at on every row it edits or adds.
--  Badge readers add rows with modified_at NULL.
-- =====================================================================

CREATE TABLE {{db}}.employees (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  department  TEXT NOT NULL
);

CREATE TABLE {{db}}.badge_scans (
  id           INTEGER PRIMARY KEY,
  employee_id  INTEGER NOT NULL REFERENCES employees(id),
  door         TEXT NOT NULL,
  direction    TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  scanned_at   TEXT NOT NULL,
  modified_at  TEXT
);

CREATE TABLE {{db}}.admin_sessions (
  id             INTEGER PRIMARY KEY,
  employee_id    INTEGER NOT NULL REFERENCES employees(id),
  workstation    TEXT NOT NULL,
  logged_in_at   TEXT NOT NULL,
  logged_out_at  TEXT NOT NULL
);

INSERT INTO {{db}}.employees (id, name, department) VALUES
  (1,  'Gideon Marsh',   'Records'),
  (2,  'Nadia Brooks',   'Records'),
  (3,  'Oswin Tate',     'Security'),
  (4,  'Priscilla Vane', 'IT'),
  (5,  'Lorenzo Quill',  'Conservation'),
  (6,  'Margaret Huang', 'Director'),
  (7,  'Felix Adebayo',  'Security'),
  (8,  'Ruth Okeke',     'Reading Room'),
  (9,  'Samir Bose',     'IT'),
  (10, 'Tamsin Wolfe',   'Conservation');

INSERT INTO {{db}}.badge_scans (id, employee_id, door, direction, scanned_at, modified_at) VALUES
  -- Tuesday 20 October, day
  (1,  6,  'Main Entrance', 'in',  '2026-10-20 08:02', NULL),
  (2,  3,  'Main Entrance', 'in',  '2026-10-20 08:05', NULL),
  (3,  2,  'Main Entrance', 'in',  '2026-10-20 08:31', NULL),
  (4,  1,  'Main Entrance', 'in',  '2026-10-20 08:40', NULL),
  (5,  5,  'Main Entrance', 'in',  '2026-10-20 08:44', NULL),
  (6,  8,  'Main Entrance', 'in',  '2026-10-20 08:50', NULL),
  (7,  8,  'Reading Room',  'in',  '2026-10-20 08:52', NULL),
  (8,  1,  'Records Vault', 'in',  '2026-10-20 09:15', NULL),
  (9,  9,  'Main Entrance', 'in',  '2026-10-20 09:30', NULL),
  (10, 9,  'Server Room',   'in',  '2026-10-20 09:35', NULL),
  (11, 1,  'Records Vault', 'out', '2026-10-20 10:02', NULL),
  (12, 9,  'Server Room',   'out', '2026-10-20 11:10', NULL),
  (13, 2,  'Records Vault', 'in',  '2026-10-20 11:20', NULL),
  (14, 2,  'Records Vault', 'out', '2026-10-20 11:48', NULL),
  (15, 10, 'Main Entrance', 'in',  '2026-10-20 12:05', NULL),
  (16, 5,  'Loading Dock',  'in',  '2026-10-20 13:30', NULL),
  (17, 5,  'Loading Dock',  'out', '2026-10-20 13:55', NULL),
  (18, 8,  'Reading Room',  'out', '2026-10-20 16:58', NULL),
  (19, 8,  'Main Entrance', 'out', '2026-10-20 17:02', NULL),
  (20, 6,  'Main Entrance', 'out', '2026-10-20 17:30', NULL),
  (21, 10, 'Main Entrance', 'out', '2026-10-20 17:40', NULL),
  (22, 5,  'Main Entrance', 'out', '2026-10-20 17:45', NULL),
  (23, 9,  'Main Entrance', 'out', '2026-10-20 17:50', NULL),
  (24, 1,  'Main Entrance', 'out', '2026-10-20 17:55', NULL),
  (25, 2,  'Main Entrance', 'out', '2026-10-20 18:01', NULL),
  (26, 3,  'Main Entrance', 'out', '2026-10-20 18:05', NULL),
  -- Tuesday 20 October, night: the charter goes missing from the vault
  (27, 7,  'Main Entrance', 'in',  '2026-10-20 20:55', NULL),
  (28, 7,  'Records Vault', 'in',  '2026-10-20 21:30', NULL),
  (29, 7,  'Records Vault', 'out', '2026-10-20 21:33', NULL),
  (30, 2,  'Main Entrance', 'in',  '2026-10-20 21:40', NULL),
  (31, 1,  'Main Entrance', 'in',  '2026-10-20 21:52', NULL),
  (32, 2,  'Reading Room',  'in',  '2026-10-20 22:10', NULL),
  (33, 1,  'Records Vault', 'in',  '2026-10-20 22:14', NULL),
  (34, 2,  'Reading Room',  'out', '2026-10-20 22:45', NULL),
  (35, 1,  'Records Vault', 'out', '2026-10-20 22:52', NULL),
  (36, 2,  'Main Entrance', 'out', '2026-10-20 22:58', NULL),
  (37, 1,  'Main Entrance', 'out', '2026-10-20 23:05', NULL),
  (38, 7,  'Main Entrance', 'out', '2026-10-21 06:00', NULL),
  -- Wednesday 21 October: the theft is discovered
  (39, 6,  'Main Entrance', 'in',  '2026-10-21 07:50', NULL),
  (40, 3,  'Main Entrance', 'in',  '2026-10-21 08:00', NULL),
  (41, 2,  'Main Entrance', 'in',  '2026-10-21 08:35', NULL),
  (42, 1,  'Main Entrance', 'in',  '2026-10-21 08:41', NULL),
  (43, 6,  'Records Vault', 'in',  '2026-10-21 08:58', NULL),
  (44, 6,  'Records Vault', 'out', '2026-10-21 09:20', NULL),
  (45, 9,  'Main Entrance', 'in',  '2026-10-21 09:45', NULL),
  (46, 9,  'Server Room',   'in',  '2026-10-21 10:00', NULL),
  -- The reader logged Lorenzo as Tamsin; IT corrected it through the console.
  (47, 5,  'Main Entrance', 'in',  '2026-10-21 08:50', '2026-10-21 10:12'),
  (48, 9,  'Server Room',   'out', '2026-10-21 10:30', NULL),
  (49, 4,  'Main Entrance', 'in',  '2026-10-21 15:40', NULL),
  (50, 4,  'Server Room',   'in',  '2026-10-21 15:55', NULL),
  (51, 4,  'Server Room',   'out', '2026-10-21 16:50', NULL),
  (52, 4,  'Main Entrance', 'out', '2026-10-21 17:00', NULL),
  (53, 2,  'Main Entrance', 'out', '2026-10-21 17:20', NULL),
  (54, 1,  'Main Entrance', 'out', '2026-10-21 17:25', NULL),
  (55, 9,  'Main Entrance', 'out', '2026-10-21 17:35', NULL),
  (56, 5,  'Main Entrance', 'out', '2026-10-21 17:40', NULL),
  (57, 3,  'Main Entrance', 'out', '2026-10-21 18:00', NULL),
  (58, 6,  'Main Entrance', 'out', '2026-10-21 18:10', NULL),
  (59, 7,  'Main Entrance', 'in',  '2026-10-21 20:58', NULL),
  (60, 7,  'Records Vault', 'in',  '2026-10-21 23:30', NULL),
  (61, 7,  'Records Vault', 'out', '2026-10-21 23:34', NULL);

INSERT INTO {{db}}.admin_sessions (id, employee_id, workstation, logged_in_at, logged_out_at) VALUES
  (1, 9, 'IT-DESK-1',   '2026-10-20 09:40', '2026-10-20 10:55'),
  (2, 9, 'IT-DESK-1',   '2026-10-21 10:05', '2026-10-21 10:20'),
  (3, 4, 'SERVER-ROOM', '2026-10-21 16:00', '2026-10-21 16:45');
