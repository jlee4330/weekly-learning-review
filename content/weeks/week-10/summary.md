---
week: 10
title: Human-AI Collaboration
status: lecture_and_slides
scope: Direct manipulation and intelligent agents; mixed-initiative interaction; steering targets and interface mechanisms.
source: https://id40018.web.app/#/lecture/10 and https://docs.google.com/presentation/d/1rsBhK-gjSMNMMSdYwKshOWTirQLERsyCDpjFZ4mpwDE/edit, inspected 2026-11-25
---

# Week 10 · Human-AI Collaboration

This summary is based on the deployed Week 10 lecture and its linked W10 Google Slides. The older local lecture file and schedule use different topics; they are not the source for this review.

## Direct manipulation and intelligent agents

The Shneiderman–Maes debate compares two approaches to user empowerment. Direct manipulation gives users visible objects, direct actions, immediate feedback, predictability and typically reversible changes. Users specify and perform actions, such as selecting, moving and resizing parts of a design. This supports understanding, control and correction, but can require substantial effort, attention and expertise.

Intelligent agents let people communicate goals and preferences while the system interprets them and performs steps. Delegation, autonomy, personalization and proactivity can reduce operational work. However, agents can misunderstand intent, take unwanted actions, or make it difficult to understand and correct their behavior.

These approaches are complementary. Neither researcher argued for eliminating all automation or all user interaction. A design tool can combine delegated work with direct editing and undo.

## Mixed-initiative interaction

Both humans and AI can initiate contributions to a shared activity. AI may ask a question, suggest an alternative, notice a problem or propose a task without waiting for a specific command. Taking initiative does not mean taking complete control.

Distinguish initiative (who introduces a contribution), roles (what each participant contributes), and authority and responsibility (who may decide and act and who oversees consequences). Proposal, approval and execution can be assigned separately. Delegating execution does not remove human or organizational accountability. Collaboration does not require equal participation at every step.

Whether AI should act, wait, suggest or ask depends on uncertainty about intent, expected benefit, interruption cost, and risk and reversibility. Permissions and user preferences also matter. A suggestion may be appropriate without permission to execute it. Asking for approval can itself be a proactive contribution.

Handoffs should communicate current state, completed work, remaining uncertainty and the decision required. Human-to-AI delegation specifies goals, constraints and permitted actions. AI-to-human escalation asks for judgment when intent is unclear, constraints conflict or the decision is outside delegated authority. Negotiation allows participants to revise plans together.

The lecture's design-team LLM Wiki example involves defining needs, AI ingestion, discovering issues, coordinating revisions, updating and verifying. Fixing a misleading answer may require changing ingestion rules, individual knowledge concepts or downstream retrieval and prompts. People and AI must coordinate who proposes, approves and implements changes and check whether the correction survives re-ingestion.

## Steering AI: what and how

The WHAT axis describes the target of control:

- Outcome: content, qualities, structure or characteristics of the result.
- Process: steps, methodology, tools, order and decision checkpoints.
- Actor & Context: role, perspective, expertise framing, information sources, tools, permissions and operating environment.

The HOW axis describes ways to express intent: direct instructions, constraints and guardrails, criteria and objectives, examples and references, direct manipulation, and feedback and corrections. Interface mechanisms can include natural language, structured fields, checkboxes, sliders, reference selection and dragging or editing objects.

One target can use several mechanisms and one mechanism can influence several targets. A role/persona instruction is a mechanism targeting Actor & Context, not an extra target. In the chair example, a user can specify the desired form and weight (Outcome), ask for multiple concepts before selection (Process), and choose a reviewer role or supply manufacturing constraints (Actor & Context). These are examples for private assessment context; the learner must develop their own examples.

Controls should affect actual system behavior. A prompt requesting read-only behavior does not itself enforce access restrictions. Actual permission boundaries require system enforcement. Roles frame behavior; they do not guarantee expertise.

## Review guidance

Ask the instructor's three questions verbatim and in order. Q1 needs an explanation of both approaches, one benefit and limitation of each, and a design-task example. Q2 needs a definition and two justified situations, distinguishing initiative from permission to act. Q3 needs one concrete control and interface mechanism for each target. Do not require researcher names, dates, all steering mechanisms or all initiative factors.

Follow-ups should address the missing part of the student's answer using one short question at a time. Do not supply examples, answers or leading choices. Accept concise reasoning in the student's own words. Use the shared five-exchange support limit, then move on without implying mastery if understanding remains insufficient.
