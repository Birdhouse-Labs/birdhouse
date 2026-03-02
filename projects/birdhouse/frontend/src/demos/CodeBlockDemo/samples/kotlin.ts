// ABOUTME: Kotlin code sample for syntax highlighting demo
// ABOUTME: Demonstrates coroutines, null safety, sealed classes, and DSL builders

import type { CodeSample } from "./types";

export const kotlin: CodeSample = {
  id: "kotlin",
  name: "Kotlin",
  language: "kotlin",
  description: "A concurrent bug tracker with coroutines, null safety, and expressive DSLs",
  code: `// Bug tracker that embraces the reality of software development

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlin.time.Duration.Companion.milliseconds

sealed class BugPriority {
    object Critical : BugPriority()
    object High : BugPriority()
    object Medium : BugPriority()
    data class Low(val willNeverFix: Boolean = true) : BugPriority()
}

data class Bug(
    val id: String,
    val title: String,
    val priority: BugPriority,
    val assignee: String?,  // null = "not it!"
    val reproducible: Boolean = false,  // usually false, let's be honest
    val worksOnMyMachine: Boolean = true
)

class BugTrackerDsl {
    private val bugs = mutableListOf<Bug>()
    
    fun bug(id: String, block: BugBuilder.() -> Unit) {
        bugs.add(BugBuilder(id).apply(block).build())
    }
    
    fun build(): List<Bug> = bugs.toList()
}

class BugBuilder(private val id: String) {
    var title: String = "Something is broken"
    var priority: BugPriority = BugPriority.Low()
    var assignee: String? = null  // null safety in action!
    var reproducible: Boolean = false
    var worksOnMyMachine: Boolean = true
    
    fun build() = Bug(id, title, priority, assignee, reproducible, worksOnMyMachine)
}

// DSL magic - because Kotlin makes this delightfully easy
fun bugTracker(block: BugTrackerDsl.() -> Unit): List<Bug> {
    return BugTrackerDsl().apply(block).build()
}

class BugTrackingSystem {
    private val bugs = mutableListOf<Bug>()
    
    // Coroutines for concurrent bug processing (because bugs come in swarms)
    suspend fun processBugs(newBugs: List<Bug>) = coroutineScope {
        newBugs.map { bug ->
            async {
                // Simulate the agony of bug investigation
                delay((100..500).random().milliseconds)
                
                val actualPriority = when {
                    bug.worksOnMyMachine && !bug.reproducible -> BugPriority.Low(willNeverFix = true)
                    bug.title.contains("production", ignoreCase = true) -> BugPriority.Critical
                    bug.assignee == null -> BugPriority.Medium  // no owner = medium priority
                    else -> bug.priority
                }
                
                bug.copy(priority = actualPriority)
            }
        }.awaitAll().also { processedBugs ->
            bugs.addAll(processedBugs)
        }
    }
    
    // Flow for real-time bug updates (because panic is a stream, not an event)
    fun monitorCriticalBugs(): Flow<Bug> = flow {
        bugs.filter { it.priority is BugPriority.Critical }
            .forEach { bug ->
                emit(bug)
                delay(100.milliseconds)  // Rate limiting our existential dread
            }
    }
    
    // Null-safe bug assignment with Elvis operator
    fun assignBug(bugId: String, developer: String?): Bug? {
        return bugs.find { it.id == bugId }?.let { bug ->
            val actualAssignee = developer ?: "The Intern"  // Elvis saves the day!
            bug.copy(assignee = actualAssignee)
        }  // Returns null if bug not found - no exceptions thrown!
    }
    
    fun getStats(): Map<String, Any> = mapOf(
        "total" to bugs.size,
        "critical" to bugs.count { it.priority is BugPriority.Critical },
        "unassigned" to bugs.count { it.assignee == null },
        "willNeverFix" to bugs.count { 
            (it.priority as? BugPriority.Low)?.willNeverFix == true 
        }
    )
}

// Usage with beautiful DSL syntax
suspend fun main() = coroutineScope {
    val tracker = BugTrackingSystem()
    
    // Define bugs with expressive DSL
    val newBugs = bugTracker {
        bug("BUG-001") {
            title = "Production is on fire"
            priority = BugPriority.High
            assignee = null  // Everyone suddenly busy
            reproducible = false
        }
        
        bug("BUG-002") {
            title = "Works on my machine"
            priority = BugPriority.Low()
            assignee = "Senior Dev"
            worksOnMyMachine = true
        }
    }
    
    // Process concurrently with coroutines
    tracker.processBugs(newBugs)
    
    // Monitor critical bugs with Flow
    tracker.monitorCriticalBugs()
        .collect { bug -> println("🚨 CRITICAL: \${bug.title}") }
    
    println(tracker.getStats())
}`,
};
