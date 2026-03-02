// ABOUTME: TOML code sample for syntax highlighting demo
// ABOUTME: Showcases TOML config file format with humorous Cargo.toml vibes

import type { CodeSample } from "./types";

export const toml: CodeSample = {
  id: "toml",
  name: "TOML",
  language: "toml",
  description: "A Cargo.toml for a crate that definitely exists and is production-ready",
  code: `# Cargo.toml for the world's most ambitious side project
# Started: 3 years ago. Last commit: "initial commit"

[package]
name = "productivity-engine"
version = "0.0.1-alpha-experimental-do-not-use"
edition = "2021"
authors = ["A Developer <definitely.not.ai@gmail.com>"]
description = "A blazingly fast, zero-cost abstraction for procrastination"
license = "WTFPL"
repository = "https://github.com/TODO/add-this-later"
keywords = ["blazingly", "fast", "rewrite-it-in-rust", "memory-safe", "no-gc"]
categories = ["definitely-production-ready"]
readme = "README.md"  # TODO: write README
rust-version = "1.75"  # Because we use bleeding edge features we don't understand

[features]
default = ["anxiety", "imposter-syndrome"]
anxiety = []
imposter-syndrome = ["anxiety"]  # Can't have one without the other
actually-works = []  # Experimental, disabled by default
enterprise = ["meetings", "jira-integration", "soul-crushing-bureaucracy"]
meetings = []
jira-integration = []
soul-crushing-bureaucracy = ["meetings", "jira-integration"]

[dependencies]
tokio = { version = "1.0", features = ["full", "rt-multi-thread", "we-need-all-of-these-trust-me"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
anyhow = "1.0"  # For when you give up on proper error handling
thiserror = "1.0"  # For when you pretend you didn't give up
rand = "0.8"  # Core business logic
regex = "1.10"  # For the one string we need to parse
reqwest = { version = "0.11", features = ["json", "cookies", "trust-dns"] }
chrono = "0.4"  # Time is an illusion. Deadlines doubly so.
uuid = { version = "1.6", features = ["v4", "serde"] }
tracing = "0.1"  # So we can pretend we know what's happening
config = "0.13"  # Ironic, isn't it?

[dependencies.leftpad]
version = "0.0.1"
optional = true  # We learned from history

[dev-dependencies]
pretty_assertions = "1.4"  # For pretty test failures
proptest = "1.4"  # We write property tests and then comment them out
criterion = "0.5"  # Benchmarks we'll run once and never again
fake = "2.9"  # All our test data is fake, just like our confidence

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"  # If we're going down, we're going down fast

[profile.dev]
opt-level = 0
debug = true
overflow-checks = true  # Trust nothing, especially ourselves

[profile.dev.package."*"]
opt-level = 2  # Dependencies can be fast. Our code? Questionable.

[[bin]]
name = "productivity-cli"
path = "src/main.rs"  # Contains: fn main() { todo!() }

[[example]]
name = "basic-usage"
path = "examples/basic.rs"  # Last modified: 2021

[workspace]
members = [
    "crates/core",           # The actual logic (3 lines of code)
    "crates/utils",          # "Utility" functions (copy-pasted from Stack Overflow)
    "crates/enterprise",     # Makes simple things complicated
    "crates/blockchain",     # Added for VC funding. Does nothing.
]

[package.metadata.docs.rs]
all-features = true
rustdoc-args = ["--cfg", "docsrs"]

# The real config was the friends we made along the way
[package.metadata.friends]
best_friend = "the compiler that yells at us"
frenemy = "the borrow checker"`,
};
