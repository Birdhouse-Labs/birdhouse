// ABOUTME: Ruby code sample for syntax highlighting demo
// ABOUTME: Demonstrates metaprogramming, blocks, Rails-like magic, and duck typing

import type { CodeSample } from "./types";

export const ruby: CodeSample = {
  id: "ruby",
  name: "Ruby",
  language: "ruby",
  description: "A DSL-powered task automation framework with Ruby magic",
  code: `# Because writing plain methods is too mainstream

module Magical
  # Metaprogramming: auto-generate getters with timestamps
  def self.included(base)
    base.extend(ClassMethods)
  end

  module ClassMethods
    def magical_attr(*attrs)
      attrs.each do |attr|
        define_method(attr) do
          instance_variable_get("@#{attr}")
        end
        
        define_method("#{attr}=") do |value|
          instance_variable_set("@#{attr}", value)
          instance_variable_set("@#{attr}_updated_at", Time.now)
          puts "✨ Magically set #{attr} at #{Time.now.strftime('%H:%M:%S')}"
        end

        define_method("#{attr}_updated_at") do
          instance_variable_get("@#{attr}_updated_at")
        end
      end
    end
  end
end

class TaskRunner
  include Magical
  
  magical_attr :name, :priority, :difficulty
  
  def initialize
    @tasks = []
    @middleware = []
  end

  # DSL method - because we love chainable methods
  def task(name, &block)
    @tasks << { name: name, action: block, status: :pending }
    self # Return self for chaining, obviously
  end

  # Middleware pattern - intercept ALL the things!
  def use(middleware_proc)
    @middleware << middleware_proc
    self
  end

  # Execute with flair
  def run!
    puts "🚀 Running #{@tasks.size} tasks with #{@middleware.size} middleware"
    
    @tasks.each_with_index do |task, idx|
      # Apply middleware chain
      execution = -> { 
        puts "  [#{idx + 1}/#{@tasks.size}] #{task[:name]}"
        task[:action].call 
      }
      
      @middleware.reverse.inject(execution) do |next_step, middleware|
        -> { middleware.call(next_step) }
      end.call
      
      task[:status] = :completed
    end
    
    self
  end

  # Operator overloading because why not
  def +(other)
    raise ArgumentError, "Can't add #{other.class}" unless other.is_a?(TaskRunner)
    
    combined = TaskRunner.new
    combined.instance_variable_set(:@tasks, @tasks + other.instance_variable_get(:@tasks))
    combined
  end

  # Block enumeration - the Ruby way
  def each_task
    return enum_for(:each_task) unless block_given?
    @tasks.each { |task| yield task }
  end

  # Functional goodness with symbol-to-proc
  def completed_tasks
    @tasks.select { |t| t[:status] == :completed }
           .map(&:values)
           .flatten
           .select { |v| v.is_a?(String) }
  end
end

# Usage with blocks and DSL
runner = TaskRunner.new

# Add timing middleware
runner.use ->(next_step) {
  start = Time.now
  next_step.call
  puts "    ⏱️  Took #{((Time.now - start) * 1000).round}ms"
}

# Define tasks with blocks (Ruby's killer feature)
runner
  .task("Compile code") { sleep(0.1); puts "    ✅ Compiled" }
  .task("Run tests") { sleep(0.2); puts "    ✅ 42 tests passed" }
  .task("Deploy") { sleep(0.15); puts "    ✅ Deployed to production" }
  .run!

# Metaprogramming in action
runner.name = "CI Pipeline"
runner.priority = "high"

puts "\\n📊 Stats: #{runner.completed_tasks.count} tasks completed"
puts "Pipeline: #{runner.name} (updated #{runner.name_updated_at})"`,
};
