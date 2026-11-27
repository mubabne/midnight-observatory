-- =====================================================================
--  Level 4 · Tampered Evidence — what happened AFTER the 01:00 backup.
--  SPOILERS. Runs on the live database only; the attached backup never
--  sees these changes.
-- =====================================================================

-- 01:38 someone signs in to the admin console from home.
INSERT INTO admin_sessions (id, employee_id, workstation, logged_in_at, logged_out_at) VALUES
  (4, 1, 'VPN (home)', '2026-10-22 01:38', '2026-10-22 01:51');

-- 01:42 two vault scans disappear.
DELETE FROM badge_scans WHERE id IN (33, 35);

-- 01:43 a colleague's Reading Room scan is moved into the vault.
UPDATE badge_scans SET door = 'Records Vault', modified_at = '2026-10-22 01:43' WHERE id = 32;

-- 01:44 an exit time is moved two hours earlier.
UPDATE badge_scans SET scanned_at = '2026-10-20 21:59', modified_at = '2026-10-22 01:44' WHERE id = 37;

-- 01:46 a vault exit that never happened is added.
INSERT INTO badge_scans (id, employee_id, door, direction, scanned_at, modified_at) VALUES
  (62, 2, 'Records Vault', 'out', '2026-10-20 22:44', '2026-10-22 01:46');

-- Thursday morning: real scans from the badge readers, after the backup.
INSERT INTO badge_scans (id, employee_id, door, direction, scanned_at, modified_at) VALUES
  (63, 7, 'Main Entrance', 'out', '2026-10-22 06:00', NULL),
  (64, 6, 'Main Entrance', 'in',  '2026-10-22 07:48', NULL),
  (65, 3, 'Main Entrance', 'in',  '2026-10-22 07:59', NULL),
  (66, 2, 'Main Entrance', 'in',  '2026-10-22 08:33', NULL),
  (67, 1, 'Main Entrance', 'in',  '2026-10-22 08:39', NULL);

INSERT INTO admin_sessions (id, employee_id, workstation, logged_in_at, logged_out_at) VALUES
  (5, 4, 'SERVER-ROOM', '2026-10-22 09:00', '2026-10-22 09:30');
