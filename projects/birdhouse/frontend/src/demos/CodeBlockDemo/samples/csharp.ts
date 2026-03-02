// ABOUTME: C# code sample for syntax highlighting demo
// ABOUTME: Demonstrates LINQ, async/await, properties, and extension methods

import type { CodeSample } from "./types";

export const csharp: CodeSample = {
  id: "csharp",
  name: "C#",
  language: "csharp",
  description: "A git repository analyzer using LINQ magic and async patterns",
  code: `// Git Analytics Engine - because devs love judging each other's commit history

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

public class Commit
{
    public string Hash { get; init; }
    public string Author { get; init; }
    public DateTime Date { get; init; }
    public string Message { get; init; }
    public int LinesAdded { get; init; }
    public int LinesDeleted { get; init; }
    public bool IsWeekend => Date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
}

public static class CommitExtensions
{
    // Extension methods: because sometimes you want to add methods to types you don't own
    public static int NetImpact(this Commit commit) => 
        commit.LinesAdded - commit.LinesDeleted;
    
    public static bool IsFixCommit(this Commit commit) =>
        commit.Message.Contains("fix", StringComparison.OrdinalIgnoreCase);
}

public class GitAnalyzer
{
    private readonly List<Commit> _commits;
    
    public GitAnalyzer(IEnumerable<Commit> commits)
    {
        _commits = commits.ToList();
    }
    
    // LINQ: making simple queries look like you're writing poetry
    public Dictionary<string, int> GetProductivityByDeveloper() =>
        _commits
            .GroupBy(c => c.Author)
            .ToDictionary(
                g => g.Key,
                g => g.Sum(c => Math.Abs(c.NetImpact()))
            );
    
    public async Task<string> FindMostDedicatedDeveloper()
    {
        // Simulating async database call (or just pretending to be busy)
        await Task.Delay(100);
        
        var weekendWarrior = _commits
            .Where(c => c.IsWeekend)
            .GroupBy(c => c.Author)
            .OrderByDescending(g => g.Count())
            .FirstOrDefault();
        
        return weekendWarrior?.Key ?? "Nobody (shocking!)";
    }
    
    public IEnumerable<(string Author, double FixRate)> CalculateFixRates()
    {
        return from author in _commits.Select(c => c.Author).Distinct()
               let authorCommits = _commits.Where(c => c.Author == author).ToList()
               let totalCommits = authorCommits.Count
               let fixCommits = authorCommits.Count(c => c.IsFixCommit())
               where totalCommits > 5 // Minimum commits for meaningful stats
               orderby (double)fixCommits / totalCommits descending
               select (author, FixRate: Math.Round((double)fixCommits / totalCommits * 100, 2));
    }
    
    // Pattern matching: making switch statements cool again
    public string GetCommitQuality(Commit commit) => commit.NetImpact() switch
    {
        < -500 => "🔥 Aggressive refactoring",
        < 0 => "👍 Code deletion is progress",
        0 => "🤔 Whitespace changes only?",
        < 10 => "✨ Surgical precision",
        < 100 => "📝 Reasonable changes",
        < 500 => "📚 Feature dump",
        _ => "⚠️ Someone's having a day"
    };
}

// Usage example
var sampleCommits = new List<Commit>
{
    new() { Hash = "abc123", Author = "Alice", Date = DateTime.Now.AddDays(-7), 
            Message = "Fix critical bug", LinesAdded = 5, LinesDeleted = 50 },
    new() { Hash = "def456", Author = "Bob", Date = DateTime.Now.AddDays(-6), 
            Message = "Add new feature", LinesAdded = 500, LinesDeleted = 10 }
};

var analyzer = new GitAnalyzer(sampleCommits);
var productivity = analyzer.GetProductivityByDeveloper();
var weekendHero = await analyzer.FindMostDedicatedDeveloper();

Console.WriteLine($"Weekend warrior: {weekendHero}");
foreach (var (author, fixRate) in analyzer.CalculateFixRates())
{
    Console.WriteLine($"{author}: {fixRate}% of commits are fixes");
}`,
};
