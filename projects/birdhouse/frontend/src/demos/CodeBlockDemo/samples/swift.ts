// ABOUTME: Swift code sample for syntax highlighting demo
// ABOUTME: Demonstrates SwiftUI, optionals, protocols, and property wrappers

import type { CodeSample } from "./types";

export const swift: CodeSample = {
  id: "swift",
  name: "Swift",
  language: "swift",
  description: "A SwiftUI app for tracking developer motivation with protocols and optionals",
  code: `// Because tracking motivation is easier than actually having it

import SwiftUI

// MARK: - Protocols (the Swift way to avoid inheritance drama)

protocol Motivational {
    var encouragementLevel: Int { get }
    func motivate() -> String
}

protocol Debuggable {
    var bugCount: Int { get set }
    mutating func squashBug() -> String?
}

// MARK: - Models

struct Developer: Motivational, Debuggable, Identifiable {
    let id = UUID()
    let name: String
    var coffeeLevel: Int
    var bugCount: Int
    
    var encouragementLevel: Int {
        // More coffee = more optimism (scientifically proven*)
        // *not scientifically proven
        return min(coffeeLevel * 10, 100)
    }
    
    func motivate() -> String {
        switch encouragementLevel {
        case 0..<20:
            return "\\(name): Maybe I should switch to design..."
        case 20..<50:
            return "\\(name): It works on my machine! 🤷‍♂️"
        case 50..<80:
            return "\\(name): Time to refactor everything!"
        default:
            return "\\(name): I AM A CODING GOD! ☕️✨"
        }
    }
    
    mutating func squashBug() -> String? {
        guard bugCount > 0 else { return nil }
        bugCount -= 1
        
        // The eternal truth of software development
        let newBugsIntroduced = Int.random(in: 0...2)
        bugCount += newBugsIntroduced
        
        return "Fixed 1 bug, introduced \\(newBugsIntroduced) new ones!"
    }
}

// MARK: - SwiftUI Views

struct DeveloperDashboardView: View {
    @State private var developers: [Developer] = [
        Developer(name: "Alice", coffeeLevel: 3, bugCount: 42),
        Developer(name: "Bob", coffeeLevel: 0, bugCount: 99),
        Developer(name: "Charlie", coffeeLevel: 5, bugCount: 0)  // The mythical bug-free developer
    ]
    
    var body: some View {
        NavigationView {
            List {
                ForEach($developers) { $dev in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(dev.name)
                                .font(.headline)
                            Spacer()
                            Text("☕️ \\(dev.coffeeLevel)")
                                .foregroundColor(.brown)
                        }
                        
                        // The motivation meter (totally accurate)
                        ProgressView(value: Double(dev.encouragementLevel), total: 100)
                            .tint(motivationColor(for: dev.encouragementLevel))
                        
                        Text(dev.motivate())
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        HStack {
                            Button("Add Coffee") {
                                dev.coffeeLevel += 1
                            }
                            
                            if dev.bugCount > 0 {
                                Button("Fix Bug (\\(dev.bugCount))") {
                                    if let result = dev.squashBug() {
                                        print(result)
                                    }
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Developer Status")
        }
    }
    
    private func motivationColor(for level: Int) -> Color {
        level < 30 ? .red : level < 70 ? .orange : .green
    }
}

// MARK: - Preview
#Preview {
    DeveloperDashboardView()
}`,
};
