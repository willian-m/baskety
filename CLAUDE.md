# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Baskety** (*Cestinha* in pt-BR) is a self-hosted, open-source grocery management app. Core differentiator: an inventory system that tracks quantities, expiration dates, and target stock levels — and auto-generates grocery lists from inventory gaps. Receipt scanning via OCR + LLM extracts purchase data to update inventory automatically.

## Tech Stack

- **Backend:** Go + PostgreSQL
- **Frontend:** React (web)
- **Mobile:** React Native
- **Deployment:** Docker Compose (primary), optional Kubernetes manifests
- **LLM integration:** Modular — supports self-hosted (Ollama) and frontier models (OpenAI, Anthropic, etc.)

## Architecture Principles

**Modularity for self-hosters:** OCR and LLM integrations must be pluggable. Users may substitute their own models. Design these as interfaces/adapters, not hardcoded implementations.

**Shared family accounts:** Multiple users share a single inventory and grocery list. All write operations must be scoped to a `household_id` (or equivalent), not just `user_id`.

**Receipt scanning flow:** OCR → text → LLM structured extraction → user review/correction → inventory update. The review step is mandatory; never auto-apply parsed data without user confirmation.

## Key Domain Concepts

- **Inventory item:** name, quantity on hand, target quantity, expiration date(s), category
- **Grocery list:** auto-generated from inventory shortfalls (quantity < target, or items expired/expiring soon); user-editable
- **Receipt scan:** raw image → OCR text → LLM-parsed line items (name, qty, price, store, brand) → pending review → committed to inventory
- **Price history:** per-item price tracking across stores and brands over time

## Build / Run Commands

> Commands will be added here once the project structure is scaffolded.

## Development Notes

- The `prompts/` directory contains agent-drafting notes — ignore it; it does not reflect current project state.
