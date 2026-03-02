// ABOUTME: C code sample for syntax highlighting demo
// ABOUTME: Demonstrates manual memory management, pointer arithmetic, and classic C patterns

import type { CodeSample } from "./types";

export const c: CodeSample = {
  id: "c",
  name: "C",
  language: "c",
  description: "A memory-managed dynamic array implementation with classic C pointer magic",
  code: `/* Dynamic Array - Because malloc() keeps us humble
 * A tale of pointers, memory, and segfaults we hope to avoid */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define INITIAL_CAPACITY 4
#define GROWTH_FACTOR 2

typedef struct {
    int *data;           // The precious heap memory
    size_t size;         // Current number of elements
    size_t capacity;     // Allocated capacity (always >= size)
    int allocation_count; // For tracking our malloc adventures
} DynamicArray;

// Initialize array - the beginning of a beautiful memory leak waiting to happen
DynamicArray* array_create(void) {
    DynamicArray *arr = (DynamicArray*)malloc(sizeof(DynamicArray));
    if (arr == NULL) {
        fprintf(stderr, "malloc failed: Welcome to embedded systems\\n");
        return NULL;
    }
    
    arr->data = (int*)malloc(INITIAL_CAPACITY * sizeof(int));
    if (arr->data == NULL) {
        free(arr); // At least we're trying to be responsible
        return NULL;
    }
    
    arr->size = 0;
    arr->capacity = INITIAL_CAPACITY;
    arr->allocation_count = 1;
    return arr;
}

// Resize when we run out of room - the realloc dance
static int array_resize(DynamicArray *arr) {
    size_t new_capacity = arr->capacity * GROWTH_FACTOR;
    int *new_data = (int*)realloc(arr->data, new_capacity * sizeof(int));
    
    if (new_data == NULL) {
        // The old pointer is still valid! realloc is considerate like that
        return -1;
    }
    
    arr->data = new_data;
    arr->capacity = new_capacity;
    arr->allocation_count++;
    
    printf("Resized to capacity %zu (allocation #%d)\\n", 
           new_capacity, arr->allocation_count);
    return 0;
}

// Add element to array - amortized O(1)* (*terms and conditions apply)
int array_push(DynamicArray *arr, int value) {
    if (arr == NULL) return -1;
    
    if (arr->size >= arr->capacity) {
        if (array_resize(arr) != 0) {
            return -1; // Houston, we have a problem
        }
    }
    
    arr->data[arr->size++] = value;
    return 0;
}

// Get element with bounds checking - we're not savages
int array_get(const DynamicArray *arr, size_t index, int *out_value) {
    if (arr == NULL || out_value == NULL) return -1;
    
    if (index >= arr->size) {
        fprintf(stderr, "Index %zu out of bounds (size: %zu)\\n", 
                index, arr->size);
        return -1;
    }
    
    *out_value = arr->data[index];
    return 0;
}

// Free everything - the most important function in C
void array_destroy(DynamicArray *arr) {
    if (arr == NULL) return;
    
    free(arr->data);     // Free the data first
    arr->data = NULL;    // Defensive programming against use-after-free
    free(arr);           // Then free the struct
    // arr = NULL;       // Can't do this - arr is passed by value!
}

// Demo usage
int main(void) {
    DynamicArray *arr = array_create();
    if (arr == NULL) {
        return EXIT_FAILURE;
    }
    
    // Add some numbers (will trigger resize at 4)
    for (int i = 0; i < 10; i++) {
        array_push(arr, i * i);
    }
    
    // Print values
    printf("Array contents:\\n");
    for (size_t i = 0; i < arr->size; i++) {
        int value;
        if (array_get(arr, i, &value) == 0) {
            printf("arr[%zu] = %d\\n", i, value);
        }
    }
    
    // The moment of truth - cleanup
    array_destroy(arr);
    // arr is now a dangling pointer! But we're done, so we're safe... right?
    
    return EXIT_SUCCESS;
}`,
};
