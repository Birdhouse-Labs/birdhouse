// ABOUTME: Rust code sample for syntax highlighting demo
// ABOUTME: Demonstrates ownership, lifetimes, traits, and Result types

import type { CodeSample } from "./types";

export const rust: CodeSample = {
  id: "rust",
  name: "Rust",
  language: "rust",
  description: "A todo app that the borrow checker actually approved",
  code: `//! A todo list that will never have memory safety issues.
//! It will, however, have mass feature creep.

use std::collections::HashMap;
use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum Priority {
    Low,
    Medium,
    High,
    OnFire, // For when everything is fine
}

#[derive(Debug, Clone)]
pub struct Todo {
    pub id: u64,
    pub title: String,
    pub completed: bool,
    pub priority: Priority,
    pub procrastinated_count: u32,
}

impl Todo {
    pub fn new(id: u64, title: impl Into<String>) -> Self {
        Self {
            id,
            title: title.into(),
            completed: false,
            priority: Priority::Medium,
            procrastinated_count: 0,
        }
    }

    pub fn procrastinate(&mut self) -> &str {
        self.procrastinated_count += 1;
        match self.procrastinated_count {
            1..=3 => "I'll do it tomorrow",
            4..=7 => "Next week for sure",
            8..=15 => "It's on my radar",
            _ => "This is now a lifestyle choice",
        }
    }
}

impl fmt::Display for Todo {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let status = if self.completed { "x" } else { " " };
        let fire = if self.priority == Priority::OnFire { " [ON FIRE]" } else { "" };
        write!(f, "[{}] {}{}", status, self.title, fire)
    }
}

pub struct TodoList {
    todos: HashMap<u64, Todo>,
    next_id: u64,
}

impl TodoList {
    pub fn new() -> Self {
        Self {
            todos: HashMap::new(),
            next_id: 1,
        }
    }

    pub fn add(&mut self, title: &str) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        self.todos.insert(id, Todo::new(id, title));
        id
    }

    pub fn complete(&mut self, id: u64) -> Result<(), TodoError> {
        self.todos
            .get_mut(&id)
            .map(|todo| todo.completed = true)
            .ok_or(TodoError::NotFound(id))
    }

    pub fn items_on_fire(&self) -> Vec<&Todo> {
        self.todos
            .values()
            .filter(|t| t.priority == Priority::OnFire && !t.completed)
            .collect()
    }

    pub fn productivity_score(&self) -> f64 {
        let total = self.todos.len() as f64;
        if total == 0.0 {
            return 100.0; // No todos = peak productivity (probably)
        }
        let completed = self.todos.values().filter(|t| t.completed).count() as f64;
        (completed / total) * 100.0
    }
}

#[derive(Debug)]
pub enum TodoError {
    NotFound(u64),
    AlreadyCompleted(u64),
}

impl std::error::Error for TodoError {}

impl fmt::Display for TodoError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(id) => write!(f, "Todo {} not found (did you finish it already?)", id),
            Self::AlreadyCompleted(id) => write!(f, "Todo {} is already done! Celebrate!", id),
        }
    }
}

fn main() {
    let mut list = TodoList::new();
    list.add("Learn Rust");
    list.add("Fight the borrow checker");
    list.add("Win against the borrow checker"); // Optional
    
    println!("Productivity: {:.1}%", list.productivity_score());
}`,
};
