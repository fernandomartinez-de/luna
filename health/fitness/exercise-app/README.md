# Exercise Browser

React + Vite app that browses ~876 exercises from a Supabase table and shows an anatomical muscle diagram per exercise using [`react-body-highlighter`](https://github.com/giavinh79/react-body-highlighter) 2.0.5.

## Prerequisites

- Node.js 18+
- npm

## Setup

```powershell
cd C:\Users\fmartine\Personal\repos\personal\health\fitness\exercise-app
npm install
```

Credentials are already in `.env` for this project. If you want to point at a different Supabase project, edit `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

## Run

```powershell
npm run dev
```

The dev server opens on http://localhost:5173.

## Build

```powershell
npm run build
npm run preview
```

## What it does

- Loads all rows from `exercises` in pages of 1000 (Supabase caps a single request at 1000 by default) and sorts by `name`.
- Filter chips restrict by `muscle_group` (10 groups: chest, back, shoulders, biceps, triceps, quadriceps, hamstrings, glutes, calves, core).
- Free-text search on `name`.
- Click a card → `/exercise/:id` shows two movement images from `images[0..1]`, the ordered `instructions[]`, plus equipment / category / level, and anterior + posterior muscle diagrams with the primary + secondary muscles highlighted.

## Muscle mapping

Table `muscle_group` (and `secondary_muscles[]`) values are mapped to `react-body-highlighter` muscle keys in [`src/utils/muscleMapping.js`](src/utils/muscleMapping.js):

| DB value    | Highlighter muscles         |
|-------------|-----------------------------|
| chest       | chest                       |
| back        | upper-back, lower-back      |
| shoulders   | front-deltoids, back-deltoids (`react-body-highlighter` does not have a `shoulders` key) |
| biceps      | biceps                      |
| triceps     | triceps                     |
| quadriceps  | quadriceps                  |
| hamstrings  | hamstring                   |
| glutes      | gluteal                     |
| calves      | calves                      |
| core        | abs, obliques               |

If you add new `muscle_group` or `secondary_muscles` values in Supabase, extend `MUSCLE_TO_HIGHLIGHTER` in the same file.

## Layout

```
exercise-app/
├── index.html
├── package.json
├── vite.config.js
├── .env
├── src/
│   ├── main.jsx
│   ├── App.jsx / App.css
│   ├── index.css
│   ├── supabaseClient.js
│   ├── components/
│   │   ├── BodyDiagram.jsx
│   │   ├── ExerciseCard.jsx
│   │   └── MuscleFilter.jsx
│   ├── pages/
│   │   ├── ExerciseListPage.jsx
│   │   └── ExerciseDetailPage.jsx
│   └── utils/
│       └── muscleMapping.js
```
