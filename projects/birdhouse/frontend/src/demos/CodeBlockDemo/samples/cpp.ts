// ABOUTME: C++ code sample for syntax highlighting demo
// ABOUTME: Demonstrates modern C++ features including RAII, templates, and smart pointers

import type { CodeSample } from "./types";

export const cpp: CodeSample = {
  id: "cpp",
  name: "C++",
  language: "cpp",
  description: "A memory-safe game engine using RAII and modern C++ patterns",
  code: `// Because manual memory management builds character (and segfaults)
#include <iostream>
#include <memory>
#include <vector>
#include <chrono>
#include <optional>
#include <string>

// RAII: Resource Acquisition Is Initialization (and Definitely Not An Excuse)
template<typename T>
class GameObject {
private:
    std::unique_ptr<T> data_;
    std::string name_;
    bool is_alive_;
    
public:
    GameObject(std::string name, T&& initial_data) 
        : data_(std::make_unique<T>(std::forward<T>(initial_data))),
          name_(std::move(name)),
          is_alive_(true) {
        std::cout << "Spawning " << name_ << " (hope you like constructors)" << std::endl;
    }
    
    // Rule of Five: Because C++ wants you to think about copying
    ~GameObject() {
        std::cout << "Destroying " << name_ << " (RAII saves the day)" << std::endl;
    }
    
    GameObject(const GameObject&) = delete;  // No copies, we're serious here
    GameObject& operator=(const GameObject&) = delete;
    
    GameObject(GameObject&& other) noexcept 
        : data_(std::move(other.data_)),
          name_(std::move(other.name_)),
          is_alive_(other.is_alive_) {}
    
    GameObject& operator=(GameObject&& other) noexcept {
        if (this != &other) {
            data_ = std::move(other.data_);
            name_ = std::move(other.name_);
            is_alive_ = other.is_alive_;
        }
        return *this;
    }
    
    std::optional<T> get_data() const {
        return is_alive_ ? std::optional<T>(*data_) : std::nullopt;
    }
    
    void kill() { is_alive_ = false; }
    const std::string& name() const { return name_; }
};

// Template metaprogramming: for when you want compile errors to be philosophical
template<typename... Components>
class Entity {
private:
    std::tuple<Components...> components_;
    
public:
    explicit Entity(Components&&... comps) 
        : components_(std::forward<Components>(comps)...) {}
    
    template<typename T>
    T& get_component() {
        return std::get<T>(components_);
    }
};

struct Transform { float x, y, z; };
struct Health { int hp; int max_hp; };
struct Attitude { std::string mood; };

int main() {
    // Smart pointers: because raw pointers are for the brave (or reckless)
    auto game_objects = std::vector<GameObject<int>>();
    
    game_objects.emplace_back("Player", 100);
    game_objects.emplace_back("Enemy", 50);
    game_objects.emplace_back("Definitely Not A Bug", 999);
    
    // Entity Component System meets template spaghetti
    auto player = Entity<Transform, Health, Attitude>(
        Transform{0.0f, 0.0f, 0.0f},
        Health{100, 100},
        Attitude{"Determined to finish this project"}
    );
    
    // Range-based for loop: because iterators are so 1998
    for (auto& obj : game_objects) {
        if (auto data = obj.get_data()) {
            std::cout << obj.name() << " has value: " << *data << std::endl;
        }
    }
    
    // Everything gets destroyed automatically here
    // No manual delete, no memory leaks, no segfaults
    // (Probably. Check valgrind to be sure.)
    
    return 0;  // The only integer modern C++ makes you return
}`,
};
