---
week: 9
title: Evaluating AI Systems
status: lecture_and_review
scope: Systematic evaluation at model, system and human-outcome levels; precision and recall; LLM-as-a-Judge.
source: https://id40018.web.app/ — Week 09 Lecture Details, deployed asset /assets/index-Dn_5SGyV.js, inspected 2026-11-12
---

# Week 09 · Evaluating AI Systems

This summary uses the deployed course's Week 09 lecture, titled Evaluating AI Systems. The local and origin/main Week9.jsx files still contain an older Human-AI Collaboration lecture. The linked slide deck was not used. The review questions are supplied by the instructor; hints and explanation criteria are authored from the deployed lecture.

## Systematic evaluation

A vibe check shows only that a system seemed to work for a few chosen cases. It does not establish reliability across users, ambiguous requests, incomplete inputs or failures. Systematic evaluation uses realistic cases and explicit criteria, includes difficult cases and appropriate clarification or abstention, separates test cases from tuning examples, repeats variable outputs and checks for regressions after changes.

Three complementary levels ask different questions:

- **Model:** Can it perform its assigned task? Assess output accuracy, relevance, robustness and consistency on defined inputs.
- **System:** Can the complete service accomplish its goal? Evaluate prompts, retrieval, tools, interfaces and error handling together, including task completion, reliability, efficiency and recovery.
- **Human outcome:** Does the service help people? Compare meaningful baselines and measure final task quality, effort, appropriate reliance and user control. Human alone, AI alone and human with AI can provide distinct comparisons.

Good model outputs do not guarantee a reliable service; a working service does not guarantee better human outcomes. Satisfaction, speed or reported trust alone can miss correction effort, errors and overreliance. Quantitative measures show whether outcomes differ; qualitative observations help explain why.

## Classification: precision and recall

Select the positive class and compare predictions with labeled cases. TP means an actual positive predicted positive; FP means an actual negative predicted positive; FN means an actual positive predicted negative; TN means an actual negative predicted negative.

- **Precision = TP / (TP + FP):** correctness among the predicted positives.
- **Recall = TP / (TP + FN):** coverage of the actual positives.

Use both to examine false alarms and missed positives and to compare thresholds or classifiers for the task. The lecture's interactive threshold demonstration shows changes in the confusion matrix and metrics. Accuracy counts all correct predictions and can conceal poor detection of a rare class. F1 balances precision and recall through their harmonic mean. A zero denominator is undefined, not evidence of perfect performance.

## LLM-as-a-Judge

The judge receives an **evaluation target**, a **rubric** defining the relevant qualities and standards, and **context** such as task requirements, audience, constraints or reference materials. Its model must support the target's modality. Targets can be human- or AI-created.

It interprets the criteria and evaluates the target, returning pointwise scores, pairwise preferences or rankings, independent ratings on multiple dimensions, or structured qualitative feedback. These are context-dependent judgments, not direct objective measurements.

Lecture limitations include position bias, verbosity bias, self-enhancement bias, sensitivity to rubric wording, limited expertise and reasonable disagreement on subjective qualities. A longer response or a differently ordered comparison can affect preference without improving quality. Validate what the judge measures, its consistency and its agreement or disagreement with independent human assessments. Human assessments are not unquestionable ground truth for subjective tasks. LLM judging complements rather than automatically replaces computational metrics and human evaluation.

## Review guidance

The three questions cover the above material. Require explanations rather than keyword lists. Hints narrow the task to one part at a time without giving a model answer. Use the shared five-exchange support limit. For Q2, use the provided email confusion matrix with spam as the positive class: TP=30, FN=10, FP=5, TN=55. Precision is 30/35 (about 85.7%) and recall is 30/40 (75%). These are private assessment references, not answers to read aloud. For Q3, ask about the learner’s completed project: its actual evaluation target, judge inputs and evaluation criteria. Do not require a judge limitation or invent project details.
