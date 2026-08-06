# Smart Exam System — Database Schema Reference

**Engine:** Prisma 7 (PostgreSQL). **Source of truth:** `server/prisma/schema.prisma`.

This document lists the exact field names and casing that the **frontend must mirror**.
Casing is `snake_case` in the DB and in API payloads. `created_at`/`id` style fields are
returned as `ISO-8601` strings in JSON.

---

## Enums (stored as strings, validated in app code)

| Field | Allowed values |
| --- | --- |
| `User.role` | `admin` · `coordinator` · `faculty` · `invigilator` · `student` |
| `User.status` | `active` · `disabled` |
| `ExamCycle.status` | `draft` · `published` · `archived` |
| `ScheduleEntry.status` | `scheduled` · `needs_review` |
| `InvigilatorAssignment.status` | `assigned` · `confirmed` · `declined` |
| `ClashRecord.type` | `same_slot` · `same_day` |
| `ClashRecord.severity` | `low` · `medium` · `high` |
| `ClashRecord.status` | `open` · `overridden` · `resolved` |
| `OverrideRequest.target_type` | `schedule_entry` · `clash_record` |
| `OverrideRequest.status` | `pending` · `approved` · `rejected` |

---

## Identity & roles

### User → table `users`
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | PK |
| `name` | String | |
| `email` | String | unique |
| `password_hash` | String | never return to client |
| `role` | String | see enum |
| `department_id` | String? | null for `admin` |
| `status` | String | default `active` |
| `must_change_password` | Boolean | default `false` |
| `created_at` | DateTime | |

### Department → table `departments`
`id` (cuid), `name` (unique), `code` (unique, e.g. `CS`), `created_at`.

### Program → table `programs`
`id`, `department_id`, `name`, `code` (e.g. `BSCS`), `duration_years` (Int, default 4).
Unique on `(department_id, code)`.

---

## Academics

### Course → table `courses`
`id`, `course_code` (unique, e.g. `CS-101`), `title`, `department_id`, `credit_hours` (Int, default 3).

### Section → table `sections`
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | PK |
| `course_id` | String | FK |
| `batch` | String | e.g. `2024` |
| `semester` | String | e.g. `Fall-2026` |

Unique on `(course_id, batch, semester)`. A section is one exam unit.

### Student → table `students`
`id`, `reg_id` (unique, e.g. `AU-2024-CS-001`), `name`, `program` (String, e.g. `BS Computer Science`), `batch`, `department_id`. Indexed on `department_id`.

### Enrollment → table `enrollments`
`id`, `student_id`, `section_id`. Unique on `(student_id, section_id)`. Indexed on both.

---

## Exam scheduling

### Room → table `rooms`
`id`, `name` (unique), `department_id` (String?, null = general purpose), `capacity` (Int).

### ExamCycle → table `exam_cycles`
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | PK |
| `name` | String | e.g. `Final Examinations Fall 2026` |
| `term` | String | e.g. `Fall-2026` |
| `start_date` | DateTime | |
| `end_date` | DateTime | |
| `status` | String | default `draft` |

### TimeSlot → table `time_slots`
`id`, `label` (e.g. `Morning`), `start_time` (DateTime, time-of-day encoded on 2000-01-01), `end_time`, `exam_cycle_id`. Unique on `(exam_cycle_id, label)`.

### ScheduleEntry → table `schedule_entries`
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | PK |
| `exam_cycle_id` | String | FK |
| `section_id` | String | FK — the section being examined |
| `date` | DateTime | exam date |
| `time_slot_id` | String | FK |
| `room_id` | String | FK |
| `status` | String | default `scheduled` |
| `created_by` | String | FK → `users.id` |
| `created_at` | DateTime | |

Unique on `(exam_cycle_id, section_id)`. Indexed on `(exam_cycle_id, date, time_slot_id)`,
`(date, time_slot_id)`, `time_slot_id`, `room_id`.

---

## Invigilation

### Invigilator → table `invigilators`
`id`, `user_id` (unique, FK → `users.id`), `department_id`, `max_assignments_per_cycle` (Int, default 5), `specialization_tags` (`String[]`).

### InvigilatorAssignment → table `invigilator_assignments`
`id`, `schedule_entry_id`, `invigilator_id`, `status` (default `assigned`).
Unique on `(schedule_entry_id, invigilator_id)`. Indexed on `invigilator_id`.

---

## Clash detection & overrides

### ClashRecord → table `clash_records`
| Field | Type | Notes |
| --- | --- | --- |
| `id` | String (cuid) | PK |
| `type` | String | `same_slot` (same day + same time) or `same_day` (same date, any time) |
| `exam_cycle_id` | String | FK |
| `student_id` | String | FK |
| `schedule_entry_ids` | `String[]` | the conflicting entries |
| `severity` | String | `high` for same_slot, `medium` for same_day, `low` for edge cases |
| `status` | String | default `open` |
| `override_reason` | String? | set when overridden |
| `created_at` | DateTime | |

Indexed on `(exam_cycle_id, status)` and `student_id`.

### OverrideRequest → table `override_requests`
`id`, `raised_by` (FK), `approved_by` (String?, FK), `target_type` (String), `target_id` (String), `reason` (String), `status` (default `pending`), `remarks` (String?), `created_at`, `decided_at` (DateTime?). Indexed on `status`.

---

## Notifications & audit

### Notification → table `notifications`
`id`, `user_id`, `type` (String, e.g. `clash`, `info`), `title`, `body` (String?), `read_at` (DateTime?), `link` (String?), `created_at`. Indexed on `(user_id, read_at)`.

### AuditLog → table `audit_log`
`id`, `action_type` (String, e.g. `exam_cycle.create`, `clash.detect`), `target_type`, `target_id`, `performed_by` (String?, FK), `timestamp`, `meta` (`Json?`). Indexed on `(target_type, target_id)` and `performed_by`.

---

## Seed data (npm run db:seed — server/)
- 5 departments, 8 programs, 32 courses, 32 sections (one per course).
- 200 students (~5 enrollments each) → 964 enrollments.
- 12 rooms, 1 exam cycle (Fall-2026, Aug 10–14), 4 time slots/day.
- 32 schedule entries with **deliberate overlaps** → 241 clash records (same_slot/same_day).
- 20 invigilators, 64 invigilator assignments, 3 override requests, notifications, audit log.
- Demo login: `admin@airuni.edu.pk` / `Password@123` (coordinator: `coordinator@airuni.edu.pk`).

All reference/status fields use the exact strings above — map them to UI badges/colors 1:1.
