---
week: 6
title: Knowledge-Augmented AI Systems - Part 2
status: lecture_and_tutorial
scope: Advanced retrieval, persistent memory, maintained knowledge, and the LLM Wiki tutorial.
source: dasd2026/src/components/lectures/Week6.jsx
---

# Week 06 · Knowledge-Augmented AI Systems - Part 2

Advanced Retrieval and Persistent Memory. This summary is based on the current local Week6.jsx lecture and tutorial, not the linked slide decks. The instructor's updated title replaces the earlier schedule-only Agentic AI placeholder.

## Learning objectives

- Explain why basic vector-based RAG is insufficient for complex information needs.
- Compare hierarchical, graph-based, corrective and adaptive retrieval strategies.
- Distinguish conversation history from persistent memory.
- Describe how systems create, update and organize knowledge over time.
- Explain how retrieval and memory decisions lead toward agentic behavior.

## Beyond basic RAG

A single vector search can serve local factual questions, but complex tasks may need evidence distributed across documents, broader context, multiple levels of abstraction or several retrieval steps. A few similar chunks do not necessarily cover the collection or support every part of an answer. Evidence may also be incomplete, outdated or contradictory.

Choose mechanisms around the user, domain and information need:

- Query rewriting improves the search formulation; decomposition separates a complex task into smaller information needs.
- Multi-query retrieval searches from several formulations or perspectives.
- Reranking reorders candidates by usefulness to the question.
- Hierarchical retrieval connects detailed passages and broader summaries.
- Retrieval evaluation checks relevance and sufficiency; correction can refine a query, search again, consult another source, request clarification or state uncertainty.

RAPTOR recursively clusters and summarizes chunks into a tree. GraphRAG organizes entities, relationships and community summaries for collection-wide questions. Self-RAG learns retrieval and self-evaluation decisions during generation. CRAG evaluates evidence and chooses refinement or further retrieval. RaFe improves query rewriting using reranker feedback. These names illustrate distinct mechanisms; recalling every paper is not required for the review questions. Advanced retrieval still does not guarantee correctness.

## Conversation history and persistent memory

Conversation history records the sequence of turns. The model can use turns supplied in its current context; saved logs are not automatically available or useful in every future session.

Persistent memory requires decisions about what to store beyond a session, how to organize or revise it, and when to bring it back into context: **Write → Organize → Read**. It can preserve events, summaries, user information or higher-level reflections. Useful memory does not remember everything equally.

The lecture discusses Generative Agents' retrieval and reflection, MemGPT's active context and archival storage management, MemoryBank's reinforcement and forgetting, and LongMemEval's extraction, multi-session reasoning, temporal reasoning, knowledge updates and abstention. New information may supersede an old fact while preserving historical context. Retrieval should select relevant, current information rather than blindly reuse old memories.

## LLM Wiki: maintained knowledge

An LLM Wiki compiles source information into reusable knowledge rather than repeatedly reconstructing it from raw history. Its three layers are:

1. **Raw sources:** original conversations, documents, notes and other evidence.
2. **Curated knowledge:** human-readable pages about concepts, people, projects, decisions or events.
3. **Maintenance rules:** instructions for creating, revising, merging, linking or retiring knowledge.

The model both reads and writes the knowledge layer. Pages can incorporate new information, merge duplicates and represent changed or conflicting facts. This is a difference in emphasis and organization, not a claim that other memory systems cannot update or organize information. An LLM Wiki can support persistent memory and can still use RAG within its curated knowledge.

The lecture introduces OKF as a portable, human- and agent-readable document structure with metadata, source links and versionable pages. Knowledge can persist independently of a specific model. Risks include persistent synthesis errors, detail lost through repeated summarization, outdated facts, conflicting sources, lost provenance and maintenance cost. Preserve raw sources, track provenance and version changes to make knowledge inspectable and correctable.

## Tutorial: build an LLM-Wiki app

Teams of three design and implement a small application that transforms sources into an evolving knowledge base.

1. Define a specific user, recurring activity and why organized knowledge is useful beyond raw history or ordinary search.
2. Choose source materials and explain their context. Simulated input data is allowed; connecting to real services is not required.
3. Define wiki concepts or entities, page contents and relationships. Decide when pages are created or updated, how conflicts and outdated information appear, and what source evidence is preserved.
4. Build a knowledge browser so users can inspect what the system knows, plus an application interface that visibly uses that structured knowledge. Demonstrate why maintained knowledge helps beyond reading the latest raw document.
5. Test new information that adds, changes or contradicts something. Trace the source input, the changed page, whether knowledge was created, updated, linked or superseded, and how application behavior changes.

The review asks students to explain their own design and a justified improvement. Do not invent their user, prototype, test result or participation. Separate actual implementation and observations from planned work. Suggestions for testing an improvement are review applications of the tutorial's update-test principle, not claims that the student already ran those tests.
