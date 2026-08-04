# Smart Exam Scheduling & Invigilation Management System

Frontend for a Smart Exam Scheduling & Invigilation Management System themed after Air University's web portal identity.

## Stack

- React 19 + Vite 8 + TypeScript
- Tailwind CSS v4 (design tokens via `@theme` in `src/index.css`)
- React Router
- Zustand (toast state)
- shadcn-style primitive components (`class-variance-authority` + `tailwind-merge`)

## Design tokens

- Navy `#0B2447`, Deep Navy `#071A33`, Gold `#C9A227`
- Success `#1E8E5A`, Danger `#D64545`, Warning `#E0A800`
- Background `#F4F6F9`, card white `#FFFFFF` with `#E3E7EE` border
- Radius scale: sm 6px / md 10px / lg 16px · Inter typeface

## Component library

Browse every primitive at `/components`: Button (variants + loading), Input (floating label + error), searchable Select, Badge/StatusChip, Card, Modal, ConfirmDialog, Toast, sortable DataTable with pagination, Tabs, Avatar, EmptyState, Skeleton.

## Getting started

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
npm run lint
```
