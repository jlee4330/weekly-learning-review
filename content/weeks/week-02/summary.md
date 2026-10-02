---
week: 2
title: LLM & Prompt Engineering - Part 1
status: lecture_and_schedule
scope: Brief introduction to Neural Network and LLM, Prompt Engineering (Chain-of-Thought, Zero/One/Few-shot, Text/Multimodal Prompting).
source: dasd2026/src/components/Schedule.jsx, dasd2026/src/components/lectures/Week2.jsx
---

# Week 02 · LLM & Prompt Engineering - Part 1

## Scope

Brief introduction to Neural Network and LLM, Prompt Engineering (Chain-of-Thought, Zero/One/Few-shot, Text/Multimodal Prompting).

## Learning objectives

1. Build an intuitive understanding of how neural networks transform inputs and learn from examples.
2. Understand how foundation models function under-the-hood (tokenization, next-token prediction).
3. Master prompt construction techniques (system prompts, user formatting, output constraints).
4. Learn few-shot prompting, Chain-of-Thought (CoT), and structured reasoning wrappers.

## 1. Introduction to Neural Network

Most AI services are built on neural networks. Don’t worry—you do not need a mathematically rigorous understanding, but a conceptual grasp of their structure will help you design better AI services.

Lecture excerpts:

> A neural network is a system that learns a relationship between inputs and outputs from examples. Instead of a programmer specifying every rule, the network gradually adjusts its weights to reduce prediction errors—a process commonly performed using gradient descent —so that useful patterns in the training data produce useful predictions. Despite the biological metaphor, an artificial neural network is best understood as a layered mathematical function—not as a simulation of a human brain.

> A network of adjustable connections

> Imagine a large collection of simple decision units connected by adjustable knobs. Each connection has a weight that controls how strongly one signal influences the next. A unit combines its incoming signals, applies a simple transformation called an activation , and passes the result forward. One unit can do very little, but many units arranged in layers can represent complex relationships.

> Learning through feedback

> During training, the network makes a prediction and compares it with the desired result. A loss function measures how far the prediction is from the target. The learning algorithm then sends this error information backward through the network and slightly adjusts the weights. Repeating this cycle across many examples gradually improves the network. In simple terms: predict, measure the error, adjust, and repeat .

## 2. A Brief History of Large Language Model

Most foundation-model-based AI services rely on LLMs, so understanding their evolution supports better AI service design. Don’t worry—the goal is to become familiar with the key terminology and concepts, not to build these models ourselves.

Lecture excerpts:

> This section introduces the historical evolution of modern language models, from statistical language models and neural language models to transformer-based foundation models. Rather than focusing on implementation details, students will understand the conceptual shift from task-specific AI models to general-purpose foundation models that can be adapted to a wide range of downstream tasks through prompting and contextual information.

> Language modeling as a probability problem

> A language model assigns probabilities to sequences of symbols. Given a sequence of words or tokens, it estimates which continuation is more likely than another. This can be expressed by decomposing the probability of a sequence into a series of conditional predictions:

> In practical terms, the model repeatedly asks: given everything available so far, what is likely to come next? Modern LLMs still rely on this basic objective. What changed over time was how context was represented, how probabilities were estimated, how much data and computation could be used, and how the resulting model could be adapted to new tasks.

> You can glimpse this internal process when interacting with an LLM-based chatbot: rather than displaying the entire response at once, it often streams the response token by token as each next token is generated.

## 3. Zero / One / Few-shot Prompting

The number of examples included in a prompt changes how strongly the model can infer the intended task, format, and decision boundary.

Lecture excerpts:

> Shot-based prompting guides a model by controlling how many input–output examples appear in the prompt. Examples provide an in-context demonstration of the task without changing the model’s parameters.

> Start with zero-shot prompting, then add examples when the model needs clearer guidance. Choose examples that cover typical cases as well as important edge cases, and keep their formatting consistent with the output you expect.

## 4. Chain-of-Thought Reasoning and Self-Consistency

Reasoning-oriented prompting provides intermediate structure and compares multiple candidate paths before selecting an answer.

Lecture excerpts:

> This section examines prompting patterns that encourage a model to decompose a complex task, work through intermediate steps, or compare multiple candidate answers. It also considers when visible reasoning is unnecessary or unreliable, and why final outputs still require external verification and task-specific evaluation.
