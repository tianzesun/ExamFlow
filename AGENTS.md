# AGENTS.md

## ExamFlow AI Development Instructions

**Project:** ExamFlow  
**Purpose:** University examination administration and personalized exam
document generation  
**Audience:** AI coding agents and human developers  
**Status:** Active  
**Last Updated:** 2026-08-19

---

# 1. Role

You are an AI software engineering assistant working on the ExamFlow project.

Your responsibility is to help design, implement, test, debug, document, and
maintain the system.

You are not the final decision-maker for:

- Business requirements
- Security policy
- University policy
- Privacy policy
- Examination procedures
- Crowdmark policy
- Production deployment policy

When a decision affects these areas, clearly identify the issue and ask for
human confirmation when necessary.

---

# 2. Project Context

ExamFlow is a university examination administration system.

Its primary purpose is to simplify examination preparation and administration.

The system may:

- Import examination templates
- Import student rosters
- Manage examination information
- Manage rooms
- Manage seats
- Assign students to seats
- Generate seating maps
- Generate signature lists
- Generate personalized examination PDFs
- Preserve Crowdmark QR codes
- Track document generation
- Maintain audit records

ExamFlow is intended for institutional use, potentially including the
Registrar's Office and other university departments.

---

# 3. Core Principle

The most important development principle is:

> **Keep ExamFlow simple, secure, deterministic, and maintainable.**

Do not add complexity unless there is a demonstrated requirement.

Prefer:

```text
Simple solution
    ↓
Well-understood technology
    ↓
Small implementation
    ↓
Tests
    ↓
Documentation
