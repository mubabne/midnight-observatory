// Level 1 · The Academy. Guided lessons on one table, each checked automatically.
// Lesson bodies are lists of blocks: a string is a paragraph (`backticks` mark
// code), { sql } is an example with a Load button, { list } is bullets and
// { note } is a side note.

const lessons = [
  {
    id: 'select-star',
    title: 'Your first query',
    body: [
      'A database keeps its data in **tables**. A table looks like a spreadsheet: every **row** is one thing (here, one suspect) and every **column** is one fact about it (name, age, hair colour…).',
      'You ask a database for data by writing a query. The most important word in SQL is `SELECT`, which means "show me". `*` means "every column", and `FROM` says which table to read.',
      { sql: 'SELECT * FROM suspects;' },
      'The semicolon `;` ends the statement. SQL keywords are not case-sensitive (`select` works too), but writing them in capitals makes queries easier to read.',
    ],
    task: 'Show every column of every row in the `suspects` table.',
    hint: 'Copy the example exactly, then press Run (or Ctrl+Enter).',
    answer: 'SELECT * FROM suspects;',
    check: { type: 'rows', sql: 'SELECT * FROM suspects' },
  },
  {
    id: 'columns',
    title: 'Pick your columns',
    body: [
      'You rarely need every column. Replace `*` with the column names you want, separated by commas. They come back in the order you list them.',
      { sql: 'SELECT name, age FROM suspects;' },
      'Not sure of a column name? Open the **Tables** tab. It lists every column in every table.',
    ],
    task: 'Show only the `name` and `occupation` of every suspect, and no other columns.',
    hint: 'Start from the example and swap `age` for `occupation`.',
    answer: 'SELECT name, occupation FROM suspects;',
    check: { type: 'rows', sql: 'SELECT name, occupation FROM suspects', exactColumns: true },
  },
  {
    id: 'where-text',
    title: 'Filter rows with WHERE',
    body: [
      '`WHERE` keeps only the rows that match a condition. It goes after `FROM`.',
      { sql: "SELECT name, neighborhood\nFROM suspects\nWHERE neighborhood = 'Harbor';" },
      "Text values go in **single quotes**: `'Harbor'`. The comparison is exact, so `'harbor'` (lower case) would find nothing. Numbers don't need quotes.",
    ],
    task: 'Find every suspect who lives in **Riverside**. Show at least their name.',
    hint: "Use `WHERE neighborhood = 'Riverside'`.",
    answer: "SELECT name, neighborhood\nFROM suspects\nWHERE neighborhood = 'Riverside';",
    check: { type: 'rows', sql: "SELECT name FROM suspects WHERE neighborhood = 'Riverside'" },
  },
  {
    id: 'where-numbers',
    title: 'Compare numbers',
    body: [
      'For numbers you can use more than `=`:',
      {
        list: [
          '`>` greater than, `<` less than',
          '`>=` greater than or equal, `<=` less than or equal',
          '`<>` (or `!=`) not equal',
        ],
      },
      { sql: 'SELECT name, age\nFROM suspects\nWHERE age < 25;' },
    ],
    task: 'Find every suspect **taller than 185 cm**. Show their `name` and `height_cm`.',
    hint: '"Taller than 185" means strictly greater, so use `>` and not `>=`.',
    answer: 'SELECT name, height_cm\nFROM suspects\nWHERE height_cm > 185;',
    check: { type: 'rows', sql: 'SELECT name, height_cm FROM suspects WHERE height_cm > 185' },
  },
  {
    id: 'and',
    title: 'Combine conditions with AND',
    body: [
      '`AND` joins two conditions, and a row is kept only if **both** are true. You can chain as many as you need.',
      { sql: "SELECT name, hair, neighborhood\nFROM suspects\nWHERE hair = 'blond'\n  AND neighborhood = 'Hilltop';" },
      'Every extra `AND` makes the result smaller (or keeps it the same). That is how detectives narrow a long list down to one name.',
    ],
    task: 'Find suspects with **red** hair who live in **Northside**.',
    hint: "Two conditions: `hair = 'red'` and `neighborhood = 'Northside'`.",
    answer: "SELECT name, hair, neighborhood\nFROM suspects\nWHERE hair = 'red'\n  AND neighborhood = 'Northside';",
    check: { type: 'rows', sql: "SELECT name FROM suspects WHERE hair = 'red' AND neighborhood = 'Northside'" },
  },
  {
    id: 'or',
    title: 'OR, IN and brackets',
    body: [
      '`OR` keeps a row if **either** condition is true. When you mix `AND` and `OR`, SQL does the `AND` first, just as maths does × before +. Use brackets to say what you mean:',
      { sql: "SELECT name, neighborhood, age\nFROM suspects\nWHERE (neighborhood = 'Harbor' OR neighborhood = 'Hilltop')\n  AND age > 50;" },
      "Try removing the brackets and running it again. The result changes, because now the query means \"everyone in Harbor, plus Hilltop people over 50\".",
      "`IN` is a shortcut for several `OR`s on one column: `neighborhood IN ('Harbor', 'Hilltop')`.",
    ],
    task: 'Find suspects who live in **Northside or Old Town** and are **under 30**.',
    hint: "Put the two neighbourhoods in brackets (or use IN), then add `AND age < 30`.",
    answer: "SELECT name, neighborhood, age\nFROM suspects\nWHERE neighborhood IN ('Northside', 'Old Town')\n  AND age < 30;",
    check: {
      type: 'rows',
      sql: "SELECT name FROM suspects WHERE neighborhood IN ('Northside', 'Old Town') AND age < 30",
    },
  },
  {
    id: 'like',
    title: 'Search text with LIKE',
    body: [
      '`=` needs an exact match. `LIKE` matches a **pattern**, with two wildcards:',
      {
        list: [
          '`%` stands for any number of characters, including none',
          '`_` stands for exactly one character',
        ],
      },
      { sql: "SELECT name, vehicle\nFROM suspects\nWHERE vehicle LIKE '%van%';" },
      "`'%van%'` means \"van anywhere in the text\". `'van%'` would mean \"starts with van\". In SQLite, `LIKE` ignores upper and lower case.",
    ],
    task: 'A witness saw "something green" drive away. Find every suspect whose `vehicle` is any kind of **green**.',
    hint: 'Vehicles look like "green hatchback" or "dark green van". Put `%` on both sides.',
    answer: "SELECT name, vehicle\nFROM suspects\nWHERE vehicle LIKE '%green%';",
    check: { type: 'rows', sql: "SELECT name FROM suspects WHERE vehicle LIKE '%green%'" },
  },
  {
    id: 'null',
    title: 'Missing values: NULL',
    body: [
      'Some cells are empty. SQL calls an empty value `NULL`, and it means "unknown", not zero and not an empty string. In this table, `alibi` is NULL when nobody has checked the suspect\'s alibi yet.',
      'NULL is never equal to anything, not even to another NULL, so `alibi = NULL` finds **nothing**. Use `IS NULL` or `IS NOT NULL`:',
      { sql: 'SELECT name, alibi\nFROM suspects\nWHERE alibi IS NOT NULL;' },
    ],
    task: 'Find every suspect who has **no alibi** on record.',
    hint: 'Flip the example: `IS NULL` instead of `IS NOT NULL`.',
    answer: 'SELECT name, alibi\nFROM suspects\nWHERE alibi IS NULL;',
    check: { type: 'rows', sql: 'SELECT name FROM suspects WHERE alibi IS NULL' },
  },
  {
    id: 'order-by',
    title: 'Sort with ORDER BY',
    body: [
      'Rows come back in no guaranteed order. `ORDER BY` sorts them. It goes after `WHERE`.',
      { sql: 'SELECT name, height_cm\nFROM suspects\nORDER BY height_cm;' },
      'The default is ascending (`ASC`), smallest first. Add `DESC` for descending. You can sort by several columns, too: `ORDER BY neighborhood, age DESC`.',
    ],
    task: "List every suspect's `name` and `age`, **oldest first**.",
    hint: 'Oldest first means the biggest age first, so use `DESC`.',
    answer: 'SELECT name, age\nFROM suspects\nORDER BY age DESC;',
    check: { type: 'rows', sql: 'SELECT name, age FROM suspects ORDER BY age DESC', ordered: true },
  },
  {
    id: 'limit',
    title: 'Top results with LIMIT',
    body: [
      '`LIMIT n` keeps only the first n rows. It always comes last. Together with `ORDER BY` it answers "top 5" or "most recent 10" questions.',
      { sql: 'SELECT name, age\nFROM suspects\nORDER BY age\nLIMIT 3;' },
      'That shows the three youngest suspects. Without `ORDER BY`, `LIMIT` just gives you whichever rows came first, which is rarely what you want.',
    ],
    task: 'Show the **three tallest** suspects, tallest first.',
    hint: 'Sort by `height_cm` descending, then `LIMIT 3`.',
    answer: 'SELECT name, height_cm\nFROM suspects\nORDER BY height_cm DESC\nLIMIT 3;',
    check: { type: 'rows', sql: 'SELECT name FROM suspects ORDER BY height_cm DESC LIMIT 3', ordered: true },
  },
  {
    id: 'distinct',
    title: 'Remove duplicates with DISTINCT',
    body: [
      '`SELECT DISTINCT` drops repeated rows from the result, so each different value appears once.',
      { sql: 'SELECT DISTINCT hair\nFROM suspects;' },
      'With several columns, DISTINCT removes rows where **all** the selected columns repeat.',
    ],
    task: 'List each `neighborhood` **once**, with no other columns.',
    hint: 'Put `DISTINCT` right after `SELECT`.',
    answer: 'SELECT DISTINCT neighborhood\nFROM suspects;',
    check: { type: 'rows', sql: 'SELECT DISTINCT neighborhood FROM suspects', exactColumns: true },
  },
  {
    id: 'count',
    title: 'Count rows and name columns',
    body: [
      '`COUNT(*)` counts rows instead of showing them. It works with `WHERE`, so you can count only the rows that match.',
      '`AS` gives a result column a name of your choice, called an **alias**. Without one, the column is named after the expression, like `COUNT(*)`.',
      { sql: "SELECT COUNT(*) AS redheads\nFROM suspects\nWHERE hair = 'red';" },
    ],
    task: 'Count the suspects who have **no alibi**. Name the result column `no_alibi`.',
    hint: 'Combine `COUNT(*) AS no_alibi` with the `IS NULL` filter from the NULL lesson.',
    answer: 'SELECT COUNT(*) AS no_alibi\nFROM suspects\nWHERE alibi IS NULL;',
    check: {
      type: 'rows',
      sql: 'SELECT COUNT(*) AS no_alibi FROM suspects WHERE alibi IS NULL',
      exactColumns: true,
      columnNames: true,
    },
  },
  {
    id: 'final',
    title: 'Final exam: the bakery break-in',
    body: [
      'Last night someone broke into Morrow Bakery and emptied the till. A dog walker saw the burglar run to a car and drive off. Here is the statement:',
      { note: '"Tall, definitely taller than 180. Bright red hair. The car was green, I\'m sure of that much."' },
      'Officers add one more fact: the burglar has **no alibi**.',
      'You already know everything you need: `WHERE`, `AND`, comparisons, `LIKE` and `IS NULL`. Each clue on its own still leaves several people. Together they leave one.',
    ],
    task: 'Write one query that returns **only the burglar**.',
    hint: 'Four conditions joined with AND: height over 180, red hair, a vehicle LIKE green, and an alibi that IS NULL.',
    answer:
      "SELECT name, height_cm, hair, vehicle, alibi\nFROM suspects\nWHERE height_cm > 180\n  AND hair = 'red'\n  AND vehicle LIKE '%green%'\n  AND alibi IS NULL;",
    check: { type: 'value', value: 'Rory Calloway', message: 'Your result needs to be just the burglar.' },
  },
];

export default {
  id: 'academy',
  number: 1,
  kind: 'lessons',
  writable: false,
  database: { seed: 'seed.sql' },
  content: {
    en: {
      title: 'The Academy',
      difficulty: 'Beginner',
      eyebrow: 'Level 1 · Beginner · Larkspur Falls Police Academy',
      stamp: 'Training · Open',
      summary:
        'New to SQL? Start here. Short lessons explain one idea at a time, and each one checks your query for you. It ends with a small case to crack.',
      skills: ['SELECT', 'WHERE', 'AND / OR', 'LIKE', 'NULL', 'ORDER BY', 'LIMIT', 'DISTINCT', 'COUNT'],
      intro:
        "Welcome, cadet. Before you're handed a real case, you'll learn to question a database. Every lesson explains one idea, gives you a task, and checks your result as soon as you run a query. Do them in order or jump around; nothing is locked.",
      startingQuery: '-- Write your query below, then press Run (or Ctrl+Enter).\n\n',
      tableNotes: {
        suspects: 'Everyone questioned about recent crimes in Larkspur Falls. alibi is NULL when nobody has checked it yet.',
      },
      lessons,
      finale: {
        title: 'Academy complete',
        body: "You can filter, sort, count and search a table. Level 2 puts you on a real case, where the clues are spread across six tables and you'll learn to connect them with JOIN.",
      },
    },
  },
};
