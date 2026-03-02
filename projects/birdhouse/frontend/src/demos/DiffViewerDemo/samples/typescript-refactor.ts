// ABOUTME: TypeScript refactoring diff sample
// ABOUTME: Shows function extraction and type improvement

import type { DiffSample } from "./types";

export const typescriptRefactor: DiffSample = {
  id: "typescript-refactor",
  name: "TypeScript Refactoring",
  filePath: "user-service.ts",
  description: "Extract validation logic and improve type safety",
  before: `interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
}

class UserService {
  async createUser(data: any): Promise<User> {
    // Validation inline
    if (!data.name || data.name.trim() === '') {
      throw new Error('Name is required');
    }
    if (!data.email || !data.email.includes('@')) {
      throw new Error('Invalid email');
    }
    if (data.age !== undefined && (data.age < 0 || data.age > 150)) {
      throw new Error('Invalid age');
    }

    const user: User = {
      id: crypto.randomUUID(),
      name: data.name.trim(),
      email: data.email.toLowerCase(),
      age: data.age,
    };

    await this.saveToDatabase(user);
    return user;
  }

  private async saveToDatabase(user: User): Promise<void> {
    // Save logic
  }
}`,
  after: `interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
}

interface CreateUserInput {
  name: string;
  email: string;
  age?: number;
}

class UserService {
  async createUser(data: CreateUserInput): Promise<User> {
    this.validateUserInput(data);

    const user: User = {
      id: crypto.randomUUID(),
      name: data.name.trim(),
      email: data.email.toLowerCase(),
      age: data.age,
    };

    await this.saveToDatabase(user);
    return user;
  }

  private validateUserInput(data: CreateUserInput): void {
    if (!data.name || data.name.trim() === '') {
      throw new Error('Name is required');
    }
    if (!data.email || !data.email.includes('@')) {
      throw new Error('Invalid email');
    }
    if (data.age !== undefined && (data.age < 0 || data.age > 150)) {
      throw new Error('Invalid age');
    }
  }

  private async saveToDatabase(user: User): Promise<void> {
    // Save logic
  }
}`,
};
