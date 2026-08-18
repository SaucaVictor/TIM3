# TIM3

A minimal, privacy-first time tracking and space management application built with **Vue 3**, **TypeScript**, **TailwindCSS**, and **Supabase**.

Designed with a sleek, dark monochrome aesthetic inspired by modern fintech interfaces, TIM3 provides frictionless time logging, real-time analytics, team billing rules, and workspace collaboration.

---

## Features

- **Minimalist Dark UI**: Built with a clean, dark `#252525` aesthetic, smooth slide-over panels, and responsive touch gestures.
- **Active Timer & Instant Logging**: Single-click timer, real-time seconds ticking, active timer indicator in header, and quick-add manual entry support.
- **Collaborative Spaces & Roles**:
  - Multi-workspace architecture with easy code sharing (`TIM3-XXXX`).
  - Three distinct permission tiers: **Owner**, **Co-Owner**, and **Member**.
  - Owners and co-owners manage projects, tasks, members, and billing rules.
- **Dynamic Age & Birthday Billing Engine**:
  - Set custom hourly rates per project based on member date of birth / age thresholds (e.g. `< 20`, `>= 20`).
  - Automatic calculation of earnings per entry, project, and team member.
- **Interactive Visual Analytics**:
  - Timeframe toggles (`1W`, `1M`, `6M`, `1Y`, `ALL`).
  - Interactive bar charts with column-level filtering for member hours and earnings breakdowns.
  - Drill down into project-specific and member-specific stats.
- **Executive Team Dashboard & CSV Export**:
  - Unified overview of team hours, amounts, projects, and active entries.
  - Multi-factor filtering (search, project, member, status, date range).
  - One-click CSV export containing full billing calculations, hourly rates, and notes.
- **Deep-Linking & Back-Button Navigation**:
  - Full URL query synchronization (`?project=...`, `?memberStats=...`) allowing browser and mobile back buttons to smoothly navigate slide-over drawers.

---

## Tech Stack

- **Frontend**: [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, Auth)
- **Icons**: [Lucide Vue Next](https://lucide.dev/)
- **Router**: [Vue Router 4](https://router.vuejs.org/)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/TIM3.git
   cd TIM3
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file in the project root (reference `.env.example`):
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Run database migrations**:
   Apply SQL migration scripts located in `supabase/migrations/` to your Supabase PostgreSQL database.

5. **Start the local development server**:
   ```bash
   npm run dev
   ```

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Vite local development server |
| `npm run build` | Type-checks with `vue-tsc` and compiles production bundle to `dist/` |
| `npm run preview` | Previews the production build locally |

---

## Project Structure

```
TIM3/
├── public/                # Static public assets
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── common/        # Base inputs, selects, and dialogs
│   │   ├── layout/        # App header, sidebar drawer
│   │   ├── projects/      # Project management & slide-overs
│   │   ├── stats/         # Analytics charts & breakdown slide-overs
│   │   └── timer/         # Active timer & entry edit drawers
│   ├── composables/       # Vue composables (auth, space, time entries, billing, export)
│   ├── lib/               # Utility functions, billing math, and Supabase client
│   ├── router/            # Vue Router navigation & route guards
│   ├── types/             # TypeScript interfaces & types
│   ├── views/             # Top-level view pages (Timer, Dashboard, Projects, Members)
│   ├── App.vue            # Main application root
│   └── main.ts            # Application entry point
├── supabase/
│   └── migrations/        # PostgreSQL schema migrations & RLS policies
├── .gitignore
├── .env.example
├── package.json
└── vite.config.ts
```

---

## License

This project is private and proprietary.
