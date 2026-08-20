ExamFlow v1 — Product Requirements Document

Product Name: ExamFlow
Product Type: University Exam Administration & Seating Platform
Primary Users: Registrar / Central Exam Office / Exam Coordinators / Instructors / Proctors
Primary Integration: Crowdmark
Version: v1.0
Status: Initial Product Definition

1. Product Vision

ExamFlow 是一个轻量、专业的大学考试行政管理工具，用于简化考试前的：

学生名单管理
考场管理
座位安排
个性化考试文件生成
Seating Map 生成
Signature List 生成
考试资料打包和打印
操作审计

ExamFlow 不替代 Crowdmark。

Crowdmark 继续负责：

Exam assessment
Exam template
QR-coded booklets
Student/exam matching
Exam submission
Scanning
Grading

ExamFlow 专注于 Crowdmark 之外的考试行政流程。

2. Problem Statement

目前考试管理过程中存在以下问题：

2.1 座位安排

考试人员需要人工决定：

Student → Room → Seat

容易出现：

重复座位
漏分配学生
座位容量不足
人工修改难以追踪
2.2 考试打印

虽然 Crowdmark 可以处理考试 booklet，但考试行政人员还需要处理：

学生与座位的对应关系
考场 seating map
签名表
打印顺序
考试资料整理
2.3 监考

监考人员需要同时知道：

Student
Student ID
Room
Seat
Signature

目前这些信息可能分散在多个文件中。

2.4 审计

当发生：

座位变更
重新打印
学生换房间
考试资料重新生成

时，需要能够回答：

谁在什么时候做了什么修改？

3. Product Goals
Goal 1 — 简化考试准备

把：

Roster
+
Exam PDF
+
Rooms
+
Seats

转换为：

Exam Package
Goal 2 — 自动化座位安排

系统能够自动完成：

Student → Room → Seat

并保证没有冲突。

Goal 3 — 自动生成考试资料

系统自动生成：

Personalized Exam PDFs
Seating Maps
Signature Lists
Exam Manifest
Goal 4 — 与 Crowdmark 配合

ExamFlow 不重新实现 Crowdmark 的功能。

目标是：

Crowdmark
     +
ExamFlow
     =
Complete Exam Administration Workflow
Goal 5 — 支持全校使用

系统设计必须支持：

多学院/部门
多课程
多考试
多考场
多用户
不同用户权限
4. Non-Goals

v1 明确不做：

不做 LMS

不管理：

Course content
Assignments
Grades
不做 grading system

所有 grading 继续使用 Crowdmark。

不做学生门户

学生不需要登录 ExamFlow。

不做 AI

v1 不需要：

LLM
AI training
RAG
Machine Learning
不做复杂 Crowdmark API

第一版优先支持：

Crowdmark Export
        ↓
ExamFlow Import

以后再增加 API integration。

不做 Registrar SIS 替代品

ExamFlow 不保存完整学生档案。

只保存考试所需的数据。

5. Target Users
5.1 System Administrator

负责：

系统配置
用户管理
Room/Seat configuration
System monitoring
5.2 Exam Coordinator

主要用户。

负责：

创建考试
导入学生
导入 Crowdmark template
选择考场
自动分配座位
调整座位
生成考试资料
5.3 Instructor

可以：

查看考试
查看学生
查看 seating
下载考试资料

权限可以低于 Exam Coordinator。

5.4 Proctor

只需要：

查看 Seating Map
查看 Signature List

不允许修改考试配置。

6. Core Workflow

这是整个系统最重要的 workflow。

Create Exam
     ↓
Import Crowdmark Exam Template
     ↓
Import Student Roster
     ↓
Select Rooms
     ↓
Validate Capacity
     ↓
Generate Seating Assignment
     ↓
Review / Adjust
     ↓
Generate Exam Package
     ↓
Download / Print
     ↓
Conduct Exam
     ↓
Crowdmark
7. Functional Requirements
FR-001 Create Exam

用户可以创建考试。

字段：

Course Code
Course Name
Exam Name
Exam Date
Start Time
Duration
Term
Notes

例如：

Course: MATH 100
Exam: Final Examination
Term: Fall 2026
Date: December 10, 2026
Time: 14:00
Duration: 180 minutes
8. FR-002 Import Exam Template

系统必须允许用户上传 Crowdmark 导出的 PDF。

支持：

PDF

系统应该检查：

文件类型
文件大小
PDF 是否有效
页数
是否能够正常读取

系统必须保留原始文件。

Original template：

exam-template-original.pdf

生成文件：

exam-template-generated.pdf

绝不修改原始模板。

9. FR-003 Import Student Roster

v1 支持 CSV。

格式：

student_id,name
1001234567,Alice Zhang
1001234568,Bob Li
1001234569,Carol Wang

系统必须验证：

Student ID 是否为空
Student ID 是否重复
Name 是否为空
CSV 格式是否正确

导入后显示：

185 students imported


Valid: 185
Errors: 0
Warnings: 0
10. FR-004 Room Management

系统管理员可以创建考场。

例如：

IA3010
IA3012
IA3160

Room 信息：

Building
Room Number
Capacity
Rows
Columns
Active / Inactive
11. FR-005 Seat Management

每个 Room 包含多个 Seat。

例如：

IA3010


A01
A02
A03
A04


B01
B02
B03
B04

Seat 属性：

Seat ID
Row
Column
Status

Status：

Available
Disabled
Reserved
12. FR-006 Seat Assignment

系统必须支持：

Automatic Assignment
Assign Students Automatically

系统按照配置的算法分配座位。

Randomized Assignment

支持随机分配。

必须允许使用：

Random Seed

这样同一个输入和 seed 可以重新生成相同结果。

这对于审计非常重要。

Manual Assignment

管理员可以手工修改：

Alice
IA3010 A07
      ↓
IA3012 B03
13. FR-007 Assignment Validation

系统必须阻止：

Two students → same seat

以及：

One student → two active seats

生成考试前必须检查：

Students assigned
Seats available
Conflicts
Unassigned students

例如：

Students: 185
Assigned: 185
Available seats: 200


Conflicts: 0

只有 validation 通过以后才能 Generate。

14. FR-008 Seating Map

系统自动生成 Seating Map。

例如：

MATH 100 FINAL
IA3010


              FRONT


A01    A02    A03    A04
Alice         Bob


B01    B02    B03    B04
Carol         David


              BACK

支持：

PDF
Print
Download
15. FR-009 Signature List

系统自动生成：

Room
Seat
Student ID
Student Name
Signature

排序方式：

Room
→ Row
→ Seat

例如：

A01  1001234567  Alice Zhang    __________
A02  1001234568  Bob Li         __________
A03  1001234569  Carol Wang     __________
16. FR-010 Personalized Exam Document

ExamFlow 根据：

Exam
+
Student
+
Room
+
Seat

生成考试 PDF。

可以添加：

Student Name
Student ID
Room
Seat
Exam Assignment ID

同时：

必须保留 Crowdmark 原始 QR code 和 booklet information。

ExamFlow 不生成 Crowdmark QR。

17. FR-011 Exam Package

系统必须能够生成完整 package：

ExamPackage.zip


/exams
    /IA3010
    /IA3012


/instructor
    seating-map-IA3010.pdf
    seating-map-IA3012.pdf
    signature-list-IA3010.pdf
    signature-list-IA3012.pdf


manifest.csv
18. FR-012 Manifest

系统生成：

assignment_id,student_id,name,room,seat

例如：

EX-000001,1001234567,Alice Zhang,IA3010,A07
EX-000002,1001234568,Bob Li,IA3010,B03

Manifest 用于：

检查
打印
审计
troubleshooting
19. FR-013 Audit Log

重要操作必须记录：

User
Timestamp
Action
Object
Previous Value
New Value

至少记录：

Exam created
Student roster imported
Room selected
Seat assigned
Seat changed
Exam generated
Document regenerated
Exam archived
20. FR-014 Exam Status

Exam lifecycle：

Draft
   ↓
Configured
   ↓
Ready
   ↓
Generated
   ↓
Completed
   ↓
Archived

只有：

Ready

状态才允许生成最终考试 package。

21. FR-015 Re-generation

如果某个学生的座位改变：

A07 → B03

系统必须允许重新生成相关文件。

同时记录：

Old:
IA3010 A07


New:
IA3012 B03
22. Security Requirements

因为这是全校 Registrar 系统，这部分必须从 v1 开始设计。

Authentication

优先使用：

University SSO / OIDC

不要自行实现密码认证。

Authorization

采用 RBAC：

Admin
Exam Coordinator
Instructor
Proctor
Student Privacy

学生信息只能在必要范围内显示。

特别是：

Student ID
Name
Exam assignment

不能出现在普通 application logs。

23. Data Retention

系统应该允许管理员设置：

Exam retention period
Document retention period
Audit retention period

考试结束后：

Active
 ↓
Archived
 ↓
Retention expired
 ↓
Deleted

具体 retention policy 后续由 Registrar / privacy requirements 确定。

24. Technical Requirements
Frontend
Next.js 16
React 19
TypeScript
Tailwind CSS
shadcn/ui
Backend
Python 3.12+
FastAPI
Pydantic v2
SQLAlchemy 2
Alembic
Database
PostgreSQL
PDF
PyMuPDF
ReportLab
Deployment
Linux
Apache
HTTPS

第一版不需要：

Kubernetes
Microservices
Kafka
AI
Vector DB
Redis

除非实际需求出现。

25. High-Level Data Model

核心数据：

User
 │
 ▼
Exam
 │
 ├──────── Student
 │
 ├──────── Room
 │            │
 │            └── Seat
 │
 └──────── ExamAssignment
                │
                ├── Student
                ├── Room
                ├── Seat
                └── Document
26. Core Database Tables

v1：

users
exams
students
exam_students
rooms
seats
exam_assignments
documents
audit_logs

以后需要再增加：

crowdmark_assessments
crowdmark_booklets
accommodations
departments
notifications

但不要第一版就建这些表。

27. Crowdmark Integration
v1

采用：

Crowdmark
   ↓
Export
   ↓
ExamFlow

输入：

Exam PDF
Student roster

ExamFlow 不修改：

Crowdmark assessment
Crowdmark QR
Crowdmark grading
Crowdmark submission
Future

如果学校获得 Crowdmark API access：

ExamFlow
    ↕
Crowdmark API

可以自动同步：

courses
students
assessments
booklet identifiers

但是这个属于 v2。

28. UX Requirements

这是全校推广成功的关键。

Requirement

一个熟悉 Crowdmark 的工作人员应该能够：

第一次使用 ExamFlow，在 5–10 分钟内完成一个考试的配置。

用户不应该需要理解：

Database
Assignment ID
UUID
PDF rendering
QR
API
technical configuration
29. UI Design Principles

采用：

Simple

Create
Import
Assign
Review
Generate

而不是：

Configuration
Advanced Configuration
System Configuration
Assignment Configuration
Document Configuration
Clear validation

例如：

✓ 185 students
✓ 200 available seats
✓ 185 assigned
✓ 0 conflicts
Dangerous actions

例如：

Delete Exam
Regenerate Exams
Change Seating

必须要求 confirmation。

30. Performance Requirements

对于全校使用，v1 至少设计为支持：

500+ students / exam
20+ rooms / exam
10,000+ seats
multiple concurrent exams

生成 500 份考试 PDF 时：

用户界面不能卡死。

应该显示：

Generating...


142 / 500


██████████░░░░░░

完成：

✓ Exam package generated
31. Reliability

生成考试是一个高风险操作。

因此：

原始 PDF 永远不能被覆盖。

系统应该保存：

Original Template
Generated Package
Generation Metadata

如果生成失败：

Generation Failed


No existing documents were modified.
32. Error Handling

错误信息必须对普通工作人员友好。

不要：

IntegrityError: UNIQUE constraint failed...

应该：

Unable to assign seat A07.


The seat is already assigned to another student.

技术错误记录在服务器日志，用户看到的是可理解的错误。

33. MVP Acceptance Criteria

ExamFlow v1 可以认为完成，当用户能够：

 创建考试
 上传 Crowdmark exam PDF
 上传学生 CSV
 创建/选择考试房间
 管理座位
 自动分配学生座位
 手工调整座位
 验证座位冲突
 生成个性化考试 PDF
 保留 Crowdmark QR/booklet 信息
 生成 Seating Map
 生成 Signature List
 生成 Manifest
 下载完整 Exam Package
 查看操作历史
 根据角色限制功能
 使用大学 SSO 登录
34. v1 明确不包含

为了防止项目失控，以下全部标记为 Future：

❌ AI assistant
❌ AI training
❌ RAG
❌ Student portal
❌ Grading
❌ LMS
❌ Full Registrar/SIS replacement
❌ Complex Crowdmark API
❌ Mobile application
❌ Automated printer control
❌ Microservices
35. 推荐开发阶段
Phase 1 — Foundation
Repository
Architecture
Authentication
Database
Basic UI
Phase 2 — Exam
Exam
Student
Roster Import
PDF Upload
Phase 3 — Seating
Rooms
Seats
Assignment
Validation
Seating UI
Phase 4 — Documents
Personalized PDF
Seating Map
Signature List
Manifest
ZIP package
Phase 5 — Administration
RBAC
Audit
Archive
Re-generation
Phase 6 — Crowdmark
Improved import/export
Crowdmark mapping
Potential API integration
36. 最重要的 Product Principle

我建议把下面这句话直接放进项目的 README.md 和 AGENTS.md：

ExamFlow does not replace Crowdmark. ExamFlow simplifies the administrative work that happens around Crowdmark.

中文就是：

ExamFlow 不替代 Crowdmark，而是简化围绕 Crowdmark 进行的考试行政工作。

这样以后 AI 给你提议：

“我们可以增加一个 grading module……”

你就可以明确拒绝。

或者 AI 建议：

“我们建立自己的 QR code system……”

也应该拒绝。

最终产品模型

我会把 ExamFlow 压缩成下面这个非常简单的公式：

                ExamFlow


       Crowdmark Exam Template
                  +
             Student Roster
                  +
             Rooms & Seats
                  ↓
          ┌───────────────┐
          │  Seat Engine  │
          └───────┬───────┘
                  ↓
          Exam Assignments
                  ↓
        ┌─────────┼─────────┐
        ↓         ↓         ↓
     Exams      Seating   Signature
     PDFs        Maps      Lists
        └─────────┼─────────┘
                  ↓
             Exam Package
                  ↓
               Crowdmark
