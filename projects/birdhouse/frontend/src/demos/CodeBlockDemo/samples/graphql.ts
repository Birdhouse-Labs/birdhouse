// ABOUTME: GraphQL code sample for syntax highlighting demo
// ABOUTME: Showcases schema definitions, queries, mutations, and subscriptions

import type { CodeSample } from "./types";

export const graphql: CodeSample = {
  id: "graphql",
  name: "GraphQL",
  language: "graphql",
  description: "A developer productivity API schema - query your burnout levels in real-time",
  code: `# Developer Productivity API
# Because REST is so 2015, and we need exactly the fields we asked for

# Custom scalars for developer-specific data types
scalar DateTime
scalar CaffeineLevel  # 0-100, where 100 is "seeing through time"
scalar BurnoutIndex   # 0-10, exponential scale

# The fundamental unit of software: a Developer
type Developer {
  id: ID!
  name: String!
  email: String!
  title: String!
  
  # Current status
  status: DeveloperStatus!
  caffeineLevel: CaffeineLevel!
  burnoutIndex: BurnoutIndex!
  lastCommit: DateTime
  
  # Relationships (like foreign keys, but graph-ier)
  team: Team!
  currentTasks: [Task!]!
  blockedBy: [Developer!]!  # For when you're waiting on code review
  meetings(upcoming: Boolean): [Meeting!]!
  
  # Computed fields
  productivityScore: Float!
  estimatedTimeToNextCoffee: Int! # minutes
  excusesRemaining: Int!
}

enum DeveloperStatus {
  CODING
  IN_MEETING
  PRETENDING_TO_WORK
  DEBUGGING
  WAITING_FOR_CI
  ON_COFFEE_BREAK
  FIGHTING_WITH_GIT
  READING_STACK_OVERFLOW
  UPDATING_DEPENDENCIES
  IN_THE_ZONE_DO_NOT_DISTURB
}

type Team {
  id: ID!
  name: String!
  members: [Developer!]!
  averageBurnout: Float!
  techDebtLevel: TechDebtLevel!
  standupTime: String  # null if team has achieved enlightenment
}

enum TechDebtLevel {
  PRISTINE          # Mythical, like unicorns
  MANAGEABLE        # We tell ourselves this
  CONCERNING        # Reality for most
  SEND_HELP         # One wrong import away from collapse
  LEGACY            # "Don't touch it, it works"
}

type Task {
  id: ID!
  title: String!
  description: String
  estimate: Int        # Story points (fictional units)
  actualTime: Int      # Always 3x the estimate
  status: TaskStatus!
  assignee: Developer
  blockers: [String!]!
  excuses: [String!]!  # Pre-populated for standup
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  IN_REVIEW
  BLOCKED
  WAITING_FOR_PRODUCT
  WORKS_ON_MY_MACHINE
  DEPLOYED_TO_PROD_FINGERS_CROSSED
}

type Meeting {
  id: ID!
  title: String!
  duration: Int!       # minutes of life you won't get back
  attendees: [Developer!]!
  couldHaveBeenAnEmail: Boolean!
  actuallyUseful: Boolean!  # Rarely true
}

# Queries - Ask and you shall receive (eventually)
type Query {
  # Get a single developer
  developer(id: ID!): Developer
  
  # Find developers by various criteria
  developers(
    status: DeveloperStatus
    minCaffeine: CaffeineLevel
    maxBurnout: BurnoutIndex
  ): [Developer!]!
  
  # Team queries
  team(id: ID!): Team
  teams: [Team!]!
  
  # The important stuff
  whoIsActuallyWorking: [Developer!]!
  whoNeedsCoffee: [Developer!]!
  whoIsAboutToBurnOut: [Developer!]!
  
  # Meeting insights
  meetingsThatCouldBeEmails(teamId: ID!): [Meeting!]!
  
  # Search
  search(query: String!): SearchResults!
}

union SearchResults = Developer | Team | Task

# Mutations - Change the world (or at least the database)
type Mutation {
  # Developer lifecycle
  createDeveloper(input: CreateDeveloperInput!): Developer!
  updateDeveloperStatus(id: ID!, status: DeveloperStatus!): Developer!
  
  # The coffee endpoint
  refillCoffee(developerId: ID!): CoffeeRefillResult!
  
  # Task management
  createTask(input: CreateTaskInput!): Task!
  assignTask(taskId: ID!, developerId: ID!): Task!
  addExcuse(taskId: ID!, excuse: String!): Task!
  
  # Meeting management
  scheduleMeeting(input: MeetingInput!): Meeting!
  cancelMeeting(id: ID!, reason: String): CancelResult!
  escapeMeeting(meetingId: ID!, excuse: String!): EscapeResult!
  
  # Emergency actions
  declareBankruptcyOnTechDebt(teamId: ID!): Team!
  initiateEmergencyCoffeeRun: CoffeeRunResult!
}

input CreateDeveloperInput {
  name: String!
  email: String!
  title: String = "Software Engineer" # Default to vague
  teamId: ID!
  caffeinePreference: CaffeineType = COFFEE
}

enum CaffeineType {
  COFFEE
  ESPRESSO
  COLD_BREW
  ENERGY_DRINK
  TEA  # For the enlightened
  PURE_CAFFEINE_IV  # For deadline week
}

type CoffeeRefillResult {
  success: Boolean!
  newCaffeineLevel: CaffeineLevel!
  message: String!  # "Achievement unlocked: 10th cup today!"
  warningLevel: WarningLevel
}

enum WarningLevel {
  NONE
  MAYBE_SLOW_DOWN
  YOUR_HEART_CALLED
  SEEK_MEDICAL_ATTENTION
}

# Subscriptions - Real-time updates for the anxious
type Subscription {
  # Watch a developer's status
  developerStatusChanged(id: ID!): Developer!
  
  # Get notified when builds fail (frequently)
  buildFailed(teamId: ID!): BuildFailure!
  
  # Monitor burnout in real-time
  burnoutAlert(threshold: BurnoutIndex!): BurnoutEvent!
  
  # The most important subscription
  coffeeBrewingComplete: CoffeeEvent!
}

type BuildFailure {
  timestamp: DateTime!
  culprit: Developer
  message: String!
  suggestedAction: String!  # Usually "git blame"
}

type BurnoutEvent {
  developer: Developer!
  burnoutIndex: BurnoutIndex!
  recommendation: String!  # "Touch grass" or "Take PTO"
}`,
};
