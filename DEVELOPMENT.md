# ExamFlow Development Guide

**Version:** 1.0  
**Status:** Proposed  
**Last Updated:** 2026-08-19

---

# 1. Purpose

This document defines how ExamFlow should be developed, tested, reviewed, and maintained.

It is intended for:

- Software developers
- System administrators
- Technical staff
- Student developers
- AI coding agents
- Future Registrar/IITS development teams

This document assumes that developers may use AI-assisted development and
vibe coding techniques.

The goal is to allow developers with limited software development experience
to contribute safely while maintaining professional engineering standards.

---

# 2. Development Philosophy

ExamFlow should be developed using the following principles:

1. Keep the system simple.
2. Build one feature at a time.
3. Prefer well-established technologies.
4. Avoid unnecessary dependencies.
5. Keep business logic deterministic.
6. Test every important feature.
7. Never sacrifice security for development convenience.
8. Never allow AI to make architectural decisions without review.
9. Keep documentation synchronized with the implementation.
10. Make small, reversible Git commits.

The development process should favor:

```text
Simple
  ↓
Understandable
  ↓
Testable
  ↓
Reliable
  ↓
Maintainable
