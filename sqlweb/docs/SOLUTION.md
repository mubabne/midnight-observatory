# Developer solutions (all levels)

> ## ⚠️ SPOILER WARNING
> This document names every culprit and walks through every level.
> It is for developers and teachers. **Don't read it if you want to play.**

<br><br><br><br><br><br>

---

## Level 1 · The Academy

Thirteen guided lessons on one table (`suspects`), each graded automatically. Every model answer is in `src/levels/academy/level.js` and is tested in `tests/levels.test.js`.

**Final exam answer: Rory Calloway.** He is the only suspect who is taller than 180 cm, has red hair, drives something green and has no alibi:

```sql
SELECT name FROM suspects
WHERE height_cm > 180 AND hair = 'red' AND vehicle LIKE '%green%' AND alibi IS NULL;
```

Near misses, one per clue: Bram Hollis (has an alibi), Dmitri Volkov (silver sedan), Kasper Wright (179 cm), Gus Pemberton and Mateo Ruiz (not red-haired), Cleo Marsh (162 cm).

---

## Level 3 · The Millrace Poisonings

**The answer: Margo Ellery**, owner of Ember & Oak Tea Bar, poisoned five customers with thallium in their hot drinks. All five had left her stall a one-star review that complained about the owner.

| Step | Query idea | Result |
| --- | --- | --- |
| 1 | `illness_reports WHERE diagnosis = 'thallium poisoning'` | 5 patients (customers 1–5) |
| 2 | CTE of patients, orders in the 48 h before `onset_at`, `GROUP BY` stall, `HAVING COUNT(DISTINCT customer_id) = 5` | Only Ember & Oak. Copperline served 4 in the window (Fern Ostrova's visit on 10 Sept is outside it). Without the window, Copperline also hits 5. |
| 3 | `LEAD(started_at) OVER (PARTITION BY staff_id ORDER BY started_at)` turns `station_log` into stints; join the 5 poisoned orders | Margo 5, Dov 5, Ines 4, Theo 4 (Copperline, if the stall filter is missing), Hazel 3, Sunny 2, Pip 1 |
| 4 | Same, `station = 'drinks'`, `HAVING … = 5` | Margo only. Dov made drinks for 2 of the 5. |

The poisoned orders are `orders` 4, 8, 12, 16 and 20. **Bonus lead:** the people with a one-star Ember & Oak review and no thallium report are Beatrix Coyle and Hugo Varela. Hugo has an allergic-reaction report, so a `LEFT JOIN` that doesn't put the diagnosis in its `ON` clause wrongly drops him, and putting it in `WHERE` returns nothing.

---

## Level 4 · Tampered Evidence

The live database is `seed.sql` plus `tamper.sql`. The backup is `seed.sql` alone, attached as `backup`.

**Who: Gideon Marsh**, through his admin console session from home, 2026-10-22 01:38–01:51 (`admin_sessions` 4). He:

- deleted his own Records Vault scans (`badge_scans` 33 and 35, 22:14 in and 22:52 out on 20 October);
- moved Nadia Brooks's Reading Room entry (32) into the Records Vault;
- moved his own exit (37) from 23:05 back to 21:59;
- forged a vault exit for Nadia (62, 22:44).

Rows 63–67 are honest scans from the next morning. They are not in the backup, so a restore that deletes every row the backup lacks fails the "Restore the evidence" check. Row 47 was a routine console fix made before the backup and appears in both copies.

The intended restore:

```sql
BEGIN;
DELETE FROM badge_scans
WHERE id NOT IN (SELECT id FROM backup.badge_scans) AND modified_at IS NOT NULL;
INSERT OR REPLACE INTO badge_scans SELECT * FROM backup.badge_scans;
COMMIT;
```

The true vault timeline for that night: Felix Adebayo in at 21:30 and out at 21:33, then Gideon Marsh in at 22:14 and out at 22:52.

---

## Level 2 · Midnight at the Observatory

### The answer

**Corin Ashdown** (id 1006, Postdoctoral Researcher, Astrophysics) killed **Dr. Imogen Varga** (id 1001, Senior Astronomer).

**Motive.** Corin submitted Varga's comet spectra (C/2026 K3) to a journal under his own name. Varga found out, showed the department chair on Friday afternoon, and planned to file a misconduct complaint on Monday. The only hard proof was the raw data on the external drive she carried everywhere.

**Method.** At 22:55 Corin borrowed a portable spectrograph in a long hard case from the self-service loan lockers. That gave him a reason to carry a big case and somewhere to hide the drive. He looked into the West Dome twice (22:41 and 23:20, when the engineer was there), then went in at 23:38 when Varga was alone. They argued. A volunteer walked in at 23:44 and was sent away. Around 23:48 Corin struck Varga with a brass counterweight, took the drive, and left at 23:51 with the case. He badged onto the Roof Deck at 23:57 and scanned into the meteor watch at 23:58 to build an alibi. He returned the case at 07:58 the next morning with the foam cut out where the drive had been.

### Timeline (Friday 16 to Saturday 17 October 2026)

| Time | Event | Source |
| --- | --- | --- |
| 22:41 to 22:47 | Corin in the West Dome (Varga not there) | access_logs 51, 53 |
| 22:55 | Corin borrows the portable spectrograph (long hard case) | equipment_loans 16 |
| 23:05 | Varga enters the West Dome. She never badges out. | access_logs 57 |
| 23:15 to 23:24 | Hattie fixes the shutter motor | access_logs 59, 63 |
| 23:20 to 23:21 | Corin looks in, sees Hattie, leaves | access_logs 61, 62; Hattie's interview |
| 23:33 to 23:36 | Rafael drops off star charts. Varga says she is "waiting for someone". | access_logs 66, 69; interview 5 |
| 23:38 | Corin enters the West Dome | access_logs 70 |
| ~23:40 | Priya hears "Those are my spectra…" / "already submitted" | interview 2; Priya out of the East Dome 23:38, onto the Roof Deck 23:44 |
| 23:44 to 23:47 | Ezra grabs his jacket and sees Varga with a red-lanyard figure and a long black case | access_logs 77, 79; interview 3 |
| 23:45 to 00:05 | Medical examiner's window for the time of death | crime_reports 9 |
| 23:51 | Corin leaves the West Dome. Tomas sees a hooded figure with a red lanyard and a long hard case. | access_logs 81; interview 1 |
| 23:57 / 23:58 | Corin reaches the Roof Deck and scans into the meteor watch | access_logs 82; event_attendance 40 |
| 00:35 | Tomas finds the body | access_logs 86 |
| 07:58 | Spectrograph returned with the foam cut out | equipment_loans 16; interview 13 |
| 10:15 | The department chair reports Varga's drive missing | crime_reports 11 |

### Canonical query path

**1. Find the report.** The starting query returns 3 reports from 17 October.

```sql
SELECT * FROM crime_reports
WHERE type = 'murder' AND location LIKE 'Halvorsen Ridge%';
```

Expected: one row, id 9. It names two witnesses: "the night custodian" and "a volunteer docent named Priya". There are two murders in the table overall, so the location filter matters.

**2. Identify the witnesses.**

```sql
SELECT * FROM people WHERE occupation LIKE '%custodian%';        -- 2 rows: Night and Day
SELECT * FROM people WHERE name LIKE 'Priya%';                   -- 2 rows: docent and gift shop clerk
```

The witnesses are Tomas Reyes (1012, Night Custodian) and Priya Raman (1019, Volunteer Docent).

**3. Read the interviews.**

```sql
SELECT p.name, i.transcript
FROM interviews i JOIN people p ON p.id = i.person_id
WHERE p.id IN (1012, 1019);
```

- Tomas: at **23:51** someone left the West Dome with a **long black hard case from the loan desk**, wearing a **red lanyard (staff)**. The door "kept beeping, same person coming back".
- Priya: around 23:40 she heard Varga say "Those are my spectra", and **a man** replied that the paper was "already submitted".

The security officer's interview (Jasper Thorne) confirms the lanyard rule: red for staff, blue for the Volunteer Program, no badge for visitors.

**4a. Who was in the West Dome?**

```sql
SELECT p.name, p.department, a.direction, a.accessed_at
FROM access_logs a JOIN people p ON p.id = a.person_id
WHERE a.location = 'West Dome'
  AND a.accessed_at BETWEEN '2026-10-16 23:00' AND '2026-10-17 00:40'
ORDER BY a.accessed_at;
```

Apart from the victim, only **Corin Ashdown** (in 23:38, out 23:51) and **Ezra Lindqvist** (23:44 to 23:47, Volunteer Program) were inside during the argument and the time-of-death window.

**4b. Who had a long hard case out at 23:51?**

```sql
SELECT p.name, p.department, l.item_name, l.borrowed_at, l.returned_at
FROM equipment_loans l JOIN people p ON p.id = l.person_id
WHERE l.item_name LIKE '%long hard case%'
  AND l.borrowed_at <= '2026-10-16 23:51'
  AND (l.returned_at IS NULL OR l.returned_at > '2026-10-16 23:51');
```

Expected: Corin Ashdown (Astrophysics), Felix Ward (Astrophysics, never returned) and Noor Haddad (Volunteer Program).

**5. Combine the filters.** This is the final hint.

```sql
SELECT DISTINCT p.name, p.department, l.item_name, l.returned_at
FROM equipment_loans AS l
JOIN people AS p      ON p.id = l.person_id
JOIN access_logs AS a ON a.person_id = p.id
WHERE l.item_name LIKE '%long hard case%'
  AND l.borrowed_at <= '2026-10-16 23:51'
  AND (l.returned_at IS NULL OR l.returned_at > '2026-10-16 23:51')
  AND a.location = 'West Dome'
  AND a.accessed_at BETWEEN '2026-10-16 23:40' AND '2026-10-16 23:55'
  AND p.department NOT IN ('Volunteer Program', 'Visitor');
```

Expected: exactly one row, **Corin Ashdown**.

**6. Corroborate.**

- Corin's interview says he went "straight up to the Roof Deck around 23:30" and never went near the West Dome. His badge shows West Dome 23:38 to 23:51, then the Roof Deck at 23:57. The meteor watch kiosk has him at 23:58.
- Ottoline Pike (department chair): a postdoc in Varga's own group submitted her spectra, and the drive is missing. There are only two Astrophysics postdocs: Corin and Lena Sato.
- Wendell Fairbanks (loan desk): a spectrograph came back at 07:58 with foam cut out "like they needed room for something small". The loan table shows that return is Corin's.
- Sofia Brandt: Varga promised "big news about integrity in science".

### Alternative routes (tested in `tests/mystery.test.js`)

**GROUP BY (the bonus lead).** Tomas thought the same badge kept coming back:

```sql
SELECT p.name, COUNT(*) AS entries
FROM access_logs a JOIN people p ON p.id = a.person_id
WHERE a.location = 'West Dome' AND a.direction = 'in'
  AND a.accessed_at LIKE '2026-10-16%'
GROUP BY p.id
HAVING COUNT(*) >= 3;
```

Expected: Corin Ashdown, 3. Without the date filter the victim also reaches 3, which is a nice teaching moment about scoping.

**Motive first, with a subquery.**

```sql
SELECT name FROM people
WHERE occupation = 'Postdoctoral Researcher' AND department = 'Astrophysics'
  AND id IN (SELECT person_id FROM access_logs
             WHERE location = 'West Dome'
               AND accessed_at BETWEEN '2026-10-16 23:40' AND '2026-10-17 00:05');
```

Expected: Corin Ashdown.

### Why the answer is unique

Three independent filters intersect on one person:

| Suspect | In the West Dome, 23:40 to 00:05 | Long hard case out at 23:51 | Staff (red lanyard) |
| --- | --- | --- | --- |
| **Corin Ashdown** | **yes** (23:38 to 23:51) | **yes** (spectrograph, back at 07:58) | **yes** |
| Ezra Lindqvist | yes (23:44 to 23:47) | no | no (volunteer) |
| Felix Ward | no (Roof Deck from 23:35) | yes (never returned) | yes |
| Noor Haddad | no (Roof Deck 22:28 to 00:20) | yes (until 00:25) | no (volunteer) |
| Rafael Moncada | left 23:36, before the argument | returned 23:19 | yes |
| Hattie Kowalczyk | left 23:24 | small case only | yes |
| Lena Sato | no (Roof Deck from 23:43) | no | yes |
| Tomas Reyes | only at 00:35, after the window | no | yes |

The case doesn't rest on a missing record. Every step uses positive records: badge scans, loan entries and kiosk check-ins. Two clearly flagged assumptions apply:

- **Badge logs are complete and accurate to the minute.** The security officer says so in his interview, and the data tests check that every person's in/out scans alternate correctly.
- **Kiosk check-outs are unreliable.** The events coordinator says so. No conclusion depends on a missing check-out. Corin's meteor-watch check-in is a positive record that contradicts his story.

### Accepted answers

The check ignores case, extra spaces and a leading title such as "Dr.", so `corin ashdown`, `  CORIN   ASHDOWN ` and `Dr. Corin Ashdown` are all accepted. A wrong name from the cast gets a nudge pointing at the evidence that clears that person. A name that isn't in `people` gets a "check the spelling" message, based on a parameterised lookup in the real database.
