// ABOUTME: Zig code sample for syntax highlighting demo
// ABOUTME: Showcases comptime, error handling, no hidden allocations, and safety features

import type { CodeSample } from "./types";

export const zig: CodeSample = {
  id: "zig",
  name: "Zig",
  language: "zig",
  description: "C's cooler younger sibling who went to therapy",
  code: `//! A memory-safe coffee brewing system.
//! No hidden allocations. No undefined behavior. No decaf.

const std = @import("std");
const Allocator = std.mem.Allocator;

/// Coffee strength levels, computed at compile time because
/// we take our caffeine seriously.
pub const CaffeineLevel = enum(u8) {
    decaf = 0,      // Why even bother?
    mild = 50,      // For cowards
    normal = 100,   // Acceptable
    strong = 200,   // Developer mode
    lethal = 255,   // Final deadline mode

    pub fn description(self: CaffeineLevel) []const u8 {
        return switch (self) {
            .decaf => "Basically hot water with commitment issues",
            .mild => "Training wheels coffee",
            .normal => "You'll survive the standup",
            .strong => "Time to mass refactor",
            .lethal => "You can see the code in the Matrix",
        };
    }
};

/// Errors that can occur during the sacred brewing ritual.
pub const BrewError = error{
    OutOfBeans,           // The worst timeline
    WaterTooHot,          // Patience, young grasshopper
    WaterTooCold,         // Did you even try?
    MachinePossessed,     // Have you tried turning it off and on?
    MondayDetected,       // Brewing requirements doubled
};

/// A single cup of liquid productivity.
pub const Coffee = struct {
    caffeine_mg: u16,
    temperature_c: f32,
    is_consumed: bool = false,
    regrets: u32 = 0,

    const Self = @This();

    /// Consume the coffee. No takebacks.
    pub fn drink(self: *Self) void {
        if (self.is_consumed) {
            self.regrets += 1;
            return; // Staring sadly at empty cup
        }
        self.is_consumed = true;
        self.temperature_c = 22.0; // Room temperature sadness
    }

    /// Check if you need another cup (spoiler: yes).
    pub fn needsRefill(self: Self) bool {
        return self.is_consumed or self.temperature_c < 40.0;
    }
};

/// Comptime function to calculate optimal coffee intake.
/// Because why compute at runtime what you can compute at compile time?
fn calculateDailyCoffeeNeed(comptime hours_of_sleep: u8) u8 {
    if (hours_of_sleep >= 8) return 1;  // Mythical creature detected
    if (hours_of_sleep >= 6) return 3;  // Functional adult
    if (hours_of_sleep >= 4) return 5;  // Software engineer
    return 255;                          // Project manager schedule
}

/// The coffee machine. Handles allocation explicitly because
/// Zig doesn't believe in surprise memory parties.
pub const CoffeeMachine = struct {
    beans_grams: u32,
    water_ml: u32,
    allocator: Allocator,
    cups_brewed: std.ArrayList(Coffee),
    is_monday: bool,

    const Self = @This();

    pub fn init(allocator: Allocator) Self {
        return .{
            .beans_grams = 1000,
            .water_ml = 2000,
            .allocator = allocator,
            .cups_brewed = std.ArrayList(Coffee).init(allocator),
            .is_monday = false, // Optimistic default
        };
    }

    pub fn deinit(self: *Self) void {
        self.cups_brewed.deinit();
        // Memory freed. No leaks. Zig is proud of you.
    }

    /// Brew coffee with explicit error handling.
    /// Because \`catch unreachable\` is for quitters.
    pub fn brew(self: *Self, strength: CaffeineLevel) BrewError!Coffee {
        if (self.is_monday) {
            // Mondays require double resources
            if (self.beans_grams < 40) return BrewError.OutOfBeans;
            self.beans_grams -= 40;
        } else {
            if (self.beans_grams < 20) return BrewError.OutOfBeans;
            self.beans_grams -= 20;
        }

        const coffee = Coffee{
            .caffeine_mg = @intFromEnum(strength),
            .temperature_c = 85.0,
        };

        self.cups_brewed.append(coffee) catch {
            // OOM while tracking coffee? The irony.
            return BrewError.MachinePossessed;
        };

        return coffee;
    }
};

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();

    const allocator = gpa.allocator();
    var machine = CoffeeMachine.init(allocator);
    defer machine.deinit();

    // Comptime calculation: 4 hours of sleep = 5 cups needed
    const cups_needed = comptime calculateDailyCoffeeNeed(4);

    std.debug.print("Coffee required today: {} cups\\n", .{cups_needed});
    std.debug.print("Strength: {}\\n", .{CaffeineLevel.strong.description()});

    var cup = machine.brew(.strong) catch |err| {
        std.debug.print("Brew failed: {}. Day ruined.\\n", .{err});
        return err;
    };

    cup.drink();
    std.debug.print("Consumed. Regrets so far: {}\\n", .{cup.regrets});
}`,
};
