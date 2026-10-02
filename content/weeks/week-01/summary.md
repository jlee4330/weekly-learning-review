---
week: 1
title: Introduction to Data-Driven AI Service Design
status: lecture_and_schedule
scope: Data-Driven AI Service (core components), Probabilistic System, Bayes’ Theorem, Foundation Models (Opportunity and Challenges).
source: Week 01 Lecture Details — Introduction to Data-Driven AI Service Design
---

# Week 01 · Introduction to Data-Driven AI Service Design

## Learning objectives

1. Explain how data, models, interaction, service logic, evaluation, and governance work together in a data-driven AI system.
2. Use conditional probability and Bayes’ theorem to describe probabilistic AI behavior, and distinguish AI system design from deterministic UI/UX design.
3. Describe the generality and adaptability of foundation models, and explain how existing models are constrained and transformed for specific interactive services.
4. Use a vibe coding environment to create, test, deploy, and submit a simple interactive web application. *(Hands-on tutorial; not discussed in the oral review.)*

## 1. How the course is designed

- The course sits at the intersection of **HCI, AI, and service design**. It is not a studio class: there is no semester-long project.
- Each week has two parts: a **lecture** (concepts and representative papers) and an **in-class tutorial** (tools and methods). Tutorials are meant to show how technical choices affect interaction quality, system behavior, transparency, controllability, and user experience.
- Students complete several individual **mini projects** on agentic design patterns (task decomposition and chaining, knowledge accumulation and memory, multi-agent simulation) and are expected to **compare alternative configurations**, not just show that an app works.
- Valued skills: clear problem formulation, evidence-based design decisions, critical reflection, and explaining *why* an architecture or interaction pattern fits.

## 2. What is a data-driven AI service?

A data-driven AI service is an interactive system whose behavior is shaped partly by **patterns learned from data** rather than entirely by rules written in advance. It uses data to recognize situations, predict, generate content, recommend actions, or adapt to a user and context.

**The model is only one component.** Service quality also depends on how data is collected and represented, how input and context reach the model, how outputs are filtered or transformed, and how people interpret, correct, or act on results. Model performance alone cannot tell you whether the service is good.

### Five core components

| Component | Role |
|---|---|
| **Data** | Examples, records, documents, feedback, and context used to train or operate the system |
| **Model** | Learns patterns and produces predictions or generated outputs |
| **Interaction** | How users express intent, receive results, give feedback, and keep control |
| **Service logic** | Rules, tools, workflows, and safeguards that connect model behavior to a real task |
| **Evaluation & governance** | Monitoring quality, managing risk, deciding whether the system stays appropriate over time |

### Data across the lifecycle

- **Training data** shapes general capabilities.
- **Application data** supplies domain knowledge and context.
- **Interaction data** can support personalization and improvement.
- **Evaluation data** shows whether the system works reliably for its intended users.

Every use of data raises design decisions about relevance, quality, consent, privacy, bias, ownership, and maintenance.

### Worked examples

| Component | Personalized learning coach | Food-waste forecasting service |
|---|---|---|
| Data | Quiz answers, activity, progress, course materials, goals | Past orders, inventory, menu, events, weather, waste records |
| Model | Estimates knowledge gaps; recommends or generates content | Forecasts demand and required ingredient quantities |
| Interaction | Dashboard or chat to view progress and revise the plan | Dashboard with forecasts, risks, editable purchase recommendations |
| Service logic | Pick suitable content, avoid repetition, respect requirements, require learner confirmation | Combine forecasts with shelf life, suppliers, menus; manager approves orders |
| Evaluation & governance | Learning gains, usefulness; protect student data; check unequal performance | Forecast error, waste reduction, stockouts; data quality; staff keep purchasing responsibility |

**Key framing:** a data-driven AI service is a **sociotechnical system**. Designing one means deciding not only what the AI can do, but when it should be used, what information it may access, how output is communicated, who stays responsible, and how failures are detected and handled.

## 3. Paradigm shift: rules-based vs. probability-based systems

- **Traditional systems are largely deterministic.** Designers specify behavior explicitly (a button triggers a function, a form validates by rules, a decision tree maps known inputs to outputs). Behavior is authored and traceable.
- **AI systems are probabilistic.** Models infer patterns from data and generate outputs from a distribution conditioned on context. The same input can produce different outputs, and a fluent answer can still be wrong or inappropriate.

| Rules-based | Probability-based |
|---|---|
| Behavior explicitly specified | Behavior learned from data |
| Same input → usually same output | Outputs may vary across runs |
| Errors traceable to code or rules | Errors emerge from data, context, or model behavior |
| Tests check expected outputs | Evaluation looks at distributions and failure modes |
| Designers define behavior directly | Designers shape and constrain behavior indirectly |

### What changes for designers

- **Direct specification → indirect shaping.** Designers influence behavior through training data, prompts, examples, retrieval sources, system instructions, memory, feedback loops, and evaluation. The design object is no longer only the interface.
- **Testing changes.** Evaluate across distributions of inputs and outcomes: reliability, variation, failure modes, bias, uncertainty, and the cost of wrong outputs. A system that is good *on average* can still be unsuitable when rare failures are costly.
- **“It works well” is not enough.** Evaluation needs context-aware metrics and explicit operating conditions:
  - performance metrics (accuracy against ground truth in a specific setting, task-time reduction, benchmarks),
  - operational context (environment, data volume, kind of user input),
  - resource and environmental efficiency (latency, token use, power, carbon).
- **HCI problem:** users tend to read fluent responses as intentional, knowledgeable, or trustworthy even when the model is uncertain. Design must help users form appropriate expectations, understand limits, recover from errors, and keep meaningful control.

## 4. Bayes’ theorem

$$P(X \mid Y) = \frac{P(Y \mid X)\,P(X)}{P(Y)}$$

- $P(X \mid Y)$: the probability of $X$ **given** that $Y$ was observed.
- Combines a **prior** belief about $X$ with **evidence** $Y$ to produce an updated **posterior**.
- Not every modern model implements Bayes explicitly, but it is a clear foundation for thinking about learning, inference, prediction, and uncertainty.
- Useful abstraction: many AI models **estimate a target $X$ conditioned on input or context $Y$**.

| Service | As $P(X \mid Y)$ |
|---|---|
| Spam detection | P(spam \| email content, sender, links, metadata) |
| Medical decision support | P(condition \| symptoms, test results) |
| Image recognition | P(object class \| pixels) |
| Recommendation | P(user preference \| history, context) |
| Language generation | P(next token \| preceding tokens) |

**Design implication:** AI output is an *inference conditioned on data and context*, not a fixed rule-based answer. Designers should ask what evidence the system receives, how that evidence changes the output, how uncertainty is shown, and how users can add information that revises the result.

## 5. HCI meets foundation models

### Origin and definition

- The term **foundation model** was coined in 2021 by Stanford HAI’s Center for Research on Foundation Models (Bommasani et al., *On the Opportunities and Risks of Foundation Models*).
- Informal label for models trained on **broad data at scale**, typically with **self-supervision**, that can be **adapted to many downstream tasks**.
- Self-supervision teaches **co-occurrence patterns** among symbols (e.g., continuing “The sandwich contains peanut…” or filling a blank). That alone does not obviously convey meaning, but training across text, code, images, audio, and sensor data can link these modalities in ways that reflect the world.
- Historical trend: **emergence and homogenization** — more capabilities emerge from scale, and many tasks converge on the same few models.

### Generality and adaptability

- **Generality (범용성):** traditional AI was narrow and single-task (spam, object detection, chess). One foundation model spans many tasks, modalities, and domains.
- **Adaptability and abstraction (추상성 및 적응성):** instead of a new pipeline per task, the same model is adapted through prompting (in-context learning), fine-tuning, or retrieval augmentation, without changing its architecture.

### Lifecycle: from pre-training to a service

1. Collect massive unlabeled data (web, books, code, papers, media).
2. Self-supervised pre-training (e.g., masked tokens for BERT, next token for GPT).
3. Base model with broad knowledge and pattern recognition.
4. Alignment and instruction tuning (SFT, RLHF) so it follows instructions helpfully and safely.
5. **Downstream adaptation** by designers and developers: system prompts, tools, RAG pipelines, light task-specific fine-tuning.

**We rarely build foundation models ourselves; we constrain and transform existing ones for specific purposes and interactions.**

### Integrating foundation models into interactive systems

- One model can support conversation, writing, summarization, classification, coding, image interpretation, planning, and tool use — enabling prototypes that once needed many specialized models or large teams.
- Interaction can be organized around **user intentions** rather than fixed functions: the system infers goals, proposes workflows, uses tools, and tailors results (mixed-initiative collaboration, personalized assistance, generative interfaces, agentic workflows).
- But broad capability blurs **interaction boundaries**: a general chatbot looks flexible yet leaves users unsure what to ask and how to judge answers.
- HCI’s role: effective prompts and controls, communicating capabilities, supporting revision and recovery, calibrating trust, representing uncertainty, and dividing labor between people and AI.

> **Key design question:** not “What can the model generate?” but “What interaction should be built around the model so its capabilities become useful, understandable, and controllable?”

| Opportunities | Challenges |
|---|---|
| Natural-language and multimodal interaction | Hallucination and factual unreliability |
| Rapid creation and transformation of content | Unpredictable, inconsistent behavior |
| Flexible support for diverse goals | Limited transparency and explainability |
| Personalized explanations and recommendations | Bias and uneven performance across users |
| Mixed-initiative collaboration | Privacy and inappropriate memory |
| Tool use and workflow automation | Automation bias and overreliance |
| Faster research prototyping | Hard-to-evaluate open-ended outputs |
| | Unclear human–AI responsibility boundaries |

## 6. Tutorial: vibe coding setup

Choose a CLI, IDE, or browser-based environment depending on how much control, setup, and deployment support a project needs. *(Practical setup; not discussed in the oral review.)*
