// ABOUTME: Type definitions for the question tool - represents interactive questions from AI to human
// ABOUTME: Shared between QuestionToolCard component and the questions API service

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionItem {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean; // always treat as true - free-text input always shown
}

export interface QuestionRequest {
  id: string;
  sessionID: string;
  questions: QuestionItem[];
  tool?: { messageID: string; callID: string };
}
