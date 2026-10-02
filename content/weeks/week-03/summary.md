---
week: 3
title: LLM & Prompt Engineering - Part 2
status: lecture_and_schedule
scope: Brief introduction to Neural Network and LLM, Prompt Engineering (Chain-of-Thought, Zero/One/Few-shot, Text/Multimodal Prompting).
source: dasd2026/src/components/Schedule.jsx, dasd2026/src/components/lectures/Week3.jsx
---

# Week 03 · LLM & Prompt Engineering - Part 2

## Scope

Brief introduction to Neural Network and LLM, Prompt Engineering (Chain-of-Thought, Zero/One/Few-shot, Text/Multimodal Prompting).

## Learning objectives

1. Recognize diverse purposes of LLM applications
2. Analyze how LLM capabilities are orchestrated for a purpose
3. Translate a human goal into an LLM interaction design
4. Apply prompt-engineering techniques as building blocks of an interaction
5. Critically evaluate whether an LLM application achieves its intended human outcome

## 1. From Prompt Engineering to Experience Design



Lecture excerpts:

> W2 introduced prompt engineering as a way to control and improve model outputs through techniques such as system prompts, few-shot examples, Chain-of-Thought, structured reasoning, decomposition, and chaining. W3 extends this perspective by treating these techniques as building blocks for designing purposeful interactions rather than as methods for obtaining a single better answer.

> The same foundation model can support very different human purposes, including learning, creativity, entertainment, collaboration, persuasion, and decision making. Designing such applications therefore begins not with “What response should the LLM generate?” but with “What experience or human outcome should this interaction create?”

> Purposeful LLM experiences can be designed along four complementary dimensions.

> User & Role Modeling concerns understanding the user—their goals, knowledge, preferences, context, and history—and defining an appropriate role for the AI, such as tutor, collaborator, coach, critic, mediator, or character.

> Representation & UI concerns how generated information is presented and interacted with. Rather than relying only on conversational text, an LLM application may use visualizations, structured views, spatial or temporal representations, multimodal content, interactive objects, or generative interfaces.

## 2. Designing LLMs for Learning



Lecture excerpts:

> A general-purpose assistant is optimized to answer questions helpfully, but effective learning may require deliberately not providing the answer immediately . A learner may need to attempt a problem, encounter difficulty, receive an appropriate hint, revise their reasoning, and reflect on what they learned.

> A useful tutoring trajectory can therefore take the form:

> Assess → Let the student struggle → Diagnose → Scaffold → Retry → Reflect.

> LLM-based tutoring requires more than a role prompt such as “You are a good teacher.” Pedagogically guided systems combine planning, scaffolding, assessment, learner modeling, memory, and adaptive control to decide what kind of intervention is appropriate at each stage of learning.

> LLMs can support different pedagogical paradigms rather than a single model of instruction. They can scaffold active knowledge construction, support cognitive processes such as comprehension and problem solving, provide feedback and reinforcement, facilitate collaborative learning, and connect learners to distributed knowledge.

## 3. Designing LLMs for Creativity



Lecture excerpts:

> Generative AI can produce apparently creative content quickly and can improve the quality of individual outputs. However, providing better ideas does not necessarily make the human creative process better. AI-generated suggestions can encourage fixation, reduce diversity across users, or shift creative ownership from the human to the system.

> It is therefore useful to distinguish three levels:

> Creativity-support tools can be designed to expand the user's space of possibilities rather than simply generate a list of ideas. Systems such as Luminate structure a creative process around:

> Map dimensions → Diverge → Explore regions → Compare → Combine → Transform → Refine.

> Important design techniques include divergence, design-space structuring, interactive exploration, comparison and reflection, combination and transformation, preservation of human initiative and ownership, diversity management, and iteration over time. The objective is not for AI to complete the creative task, but to help the human reach possibilities they might not otherwise encounter.

## 4. Designing LLMs for Entertainment



Lecture excerpts:

> An LLM may be capable of generating jokes, dialogue, characters, or individual scenes, but sustained entertainment requires these elements to form a coherent interactive experience. Interactive drama, for example, combines plot, character, thought, diction, spectacle, and interaction rather than relying on dialogue generation alone.

> Entertainment systems therefore need to maintain world state, character personality and motivation, relationships, previous events, and narrative progression. They may also combine language with visual environments, audio, characters, objects, and other interactive representations.

> A central tension in interactive entertainment is the balance between player agency and narrative control. Players should be able to make meaningful and unexpected choices, while the system must still maintain a coherent and engaging story.

> One approach is to separate responsibilities across agents. A Director Agent can manage the overall plot, decide what should happen next, and reschedule events in response to player intervention, while Actor Agents maintain individual characters and generate in-character behavior. Other important mechanisms include world and state modeling, character modeling, narrative planning, memory and continuity, and multimodal representation.

## 5. Designing LLMs for Human–Human Collaboration



Lecture excerpts:

> LLMs can participate not only as assistants to individual users but also as facilitators between multiple people. In this role, the objective is not to decide on behalf of the group but to improve the process through which the group reaches an outcome.

> A designed deliberation process can involve:

> Elicit individual views → Synthesize → Evaluate → Critique → Incorporate dissent → Revise → Find common ground.

> Importantly, collaboration has multiple possible outcomes: participation, information sharing, equality, common ground, decision quality, and satisfaction. Improving one does not automatically improve the others.

> Effective AI facilitation requires more than summarizing what participants have said. The system may need to elicit perspectives, represent agreement and disagreement, model common ground, manage participation and turns, preserve minority viewpoints during synthesis, reframe conflicts, and support iterative deliberation.
