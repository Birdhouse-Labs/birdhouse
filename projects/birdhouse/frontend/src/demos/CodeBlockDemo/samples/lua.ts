// ABOUTME: Lua code sample for syntax highlighting demo
// ABOUTME: Demonstrates metatables, coroutines, and game scripting patterns

import type { CodeSample } from "./types";

export const lua: CodeSample = {
  id: "lua",
  name: "Lua",
  language: "lua",
  description: "A quirky RPG enemy system with metatables and coroutines",
  code: `-- A simple enemy AI system that's definitely not overthinking things

local Enemy = {}
Enemy.__index = Enemy

-- Constructor for our perpetually frustrated enemies
function Enemy:new(name, health, personality)
  local instance = setmetatable({}, self)
  instance.name = name
  instance.health = health
  instance.personality = personality or "grumpy"
  instance.state = "idle"
  instance.thoughts = {}
  return instance
end

-- Metatables let us do fun operator overloading
function Enemy:__tostring()
  return string.format("%s (HP: %d, feeling: %s)", 
    self.name, self.health, self.personality)
end

function Enemy:__add(other)
  -- When two enemies meet, they form a boss (obviously)
  local boss = Enemy:new(
    self.name .. " & " .. other.name,
    self.health + other.health,
    "absolutely livid"
  )
  return boss
end

-- Coroutines for smooth AI behavior (no blocking here!)
function Enemy:createBehaviorRoutine()
  return coroutine.create(function()
    while self.health > 0 do
      -- Idle phase: enemy contemplates existence
      self.state = "thinking"
      table.insert(self.thoughts, "Why am I guarding this treasure?")
      coroutine.yield()
      
      -- Alert phase: enemy spots player
      if math.random() > 0.7 then
        self.state = "alert"
        table.insert(self.thoughts, "Was that... a player?!")
        coroutine.yield()
        
        -- Attack phase: enemy does something
        self.state = "attacking"
        self:performAttack()
        coroutine.yield()
      end
      
      -- Back to idle
      self.state = "idle"
      coroutine.yield()
    end
  end)
end

function Enemy:performAttack()
  local attacks = {
    "waves menacingly",
    "questions your build choices",
    "drops frame rate to assert dominance",
    "spawns adds (because of course)"
  }
  local attack = attacks[math.random(#attacks)]
  print(self.name .. " " .. attack)
end

function Enemy:takeDamage(amount)
  self.health = math.max(0, self.health - amount)
  
  if self.health > 0 then
    print(self.name .. " grunts disapprovingly")
  else
    print(self.name .. " drops uncommon loot and disappointment")
  end
  
  return self.health == 0
end

-- Usage example
local goblin = Enemy:new("Goblin Scout", 50, "mildly annoyed")
local orc = Enemy:new("Orc Warrior", 100, "professionally grumpy")

print(goblin)  -- __tostring metamethod in action

-- Combine enemies to create a boss (why not?)
local boss = goblin + orc  -- __add metamethod
print("Oh no, they fused!")
print(boss)

-- Run AI behavior with coroutines
local routine = boss:createBehaviorRoutine()

for i = 1, 5 do
  if coroutine.status(routine) == "suspended" then
    coroutine.resume(routine)
    print(string.format("Frame %d: %s is %s", i, boss.name, boss.state))
  end
end

-- Boss monologue (they always have one)
print("\\nBoss thoughts:")
for i, thought in ipairs(boss.thoughts) do
  print(string.format("  %d. %s", i, thought))
end`,
};
