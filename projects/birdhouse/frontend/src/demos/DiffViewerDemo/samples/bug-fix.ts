// ABOUTME: Bug fix diff sample
// ABOUTME: Shows fixing off-by-one error and edge case handling

import type { DiffSample } from "./types";

export const bugFix: DiffSample = {
  id: "bug-fix",
  name: "Bug Fix",
  filePath: "array-utils.ts",
  description: "Fix off-by-one error and add null checks",
  before: `export function getLastNItems<T>(arr: T[], n: number): T[] {
  if (n === 0) return [];
  return arr.slice(arr.length - n, arr.length);
}

export function findMostCommon<T>(arr: T[]): T {
  const counts = new Map<T, number>();
  
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  let maxCount = 0;
  let mostCommon = arr[0];

  for (const [item, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = item;
    }
  }

  return mostCommon;
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i <= arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}`,
  after: `export function getLastNItems<T>(arr: T[], n: number): T[] {
  if (n === 0) return [];
  if (n < 0) return [];
  if (n >= arr.length) return [...arr];
  return arr.slice(arr.length - n, arr.length);
}

export function findMostCommon<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  
  const counts = new Map<T, number>();
  
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  let maxCount = 0;
  let mostCommon = arr[0];

  for (const [item, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = item;
    }
  }

  return mostCommon;
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}`,
};
