// ABOUTME: Java code sample for syntax highlighting demo
// ABOUTME: Demonstrates enterprise patterns, Spring-style annotations, and over-engineering

import type { CodeSample } from "./types";

export const java: CodeSample = {
  id: "java",
  name: "Java",
  language: "java",
  description: "Enterprise FizzBuzz with Spring Boot annotations and dependency injection",
  code: `// Enterprise-Grade FizzBuzz Solution
// Version 2.1.0-SNAPSHOT (because production is a myth)

package com.enterprise.fizzbuzz.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import javax.annotation.PostConstruct;
import java.util.Optional;
import java.util.List;
import java.util.stream.IntStream;

/**
 * AbstractSingletonProxyFactoryBean for FizzBuzz operations
 * TODO: Refactor to use microservices architecture
 */
@Service
@Configuration
public class EnterpriseGradeFizzBuzzServiceImpl 
    implements IFizzBuzzService, IFizzBuzzProvider {
    
    @Autowired
    private FizzBuzzConfigurationProperties config;
    
    @Autowired
    private FizzBuzzMetricsCollector metricsCollector;
    
    @Autowired
    private Optional<FizzBuzzAuditLogger> auditLogger;
    
    private static final String FIZZ = "Fizz";
    private static final String BUZZ = "Buzz";
    private static final String FIZZ_BUZZ = FIZZ + BUZZ;
    
    @PostConstruct
    public void init() {
        // Initialize the bean factory factory
        auditLogger.ifPresent(logger -> 
            logger.logInitialization("FizzBuzz service initialized"));
    }
    
    /**
     * Processes a number through the FizzBuzz algorithm
     * @param number The input integer to process
     * @return A FizzBuzzResult containing the processed value
     * @throws FizzBuzzException if number is negative or exceeds MAX_VALUE
     */
    @Override
    public FizzBuzzResult process(Integer number) throws FizzBuzzException {
        if (number == null) {
            throw new FizzBuzzException("Number cannot be null. Use Optional.");
        }
        
        metricsCollector.incrementProcessedCount();
        
        return FizzBuzzResult.builder()
            .originalValue(number)
            .processedValue(processInternal(number))
            .timestamp(System.currentTimeMillis())
            .build();
    }
    
    private String processInternal(Integer n) {
        // Business logic extracted to private method for testability
        if (isDivisibleBy(n, 15)) {
            return FIZZ_BUZZ;  // The rare double-interface implementation
        }
        if (isDivisibleBy(n, 3)) {
            return FIZZ;  // Classic Fizz scenario
        }
        if (isDivisibleBy(n, 5)) {
            return BUZZ;  // Classic Buzz scenario
        }
        return String.valueOf(n);  // Fallback to legacy behavior
    }
    
    private boolean isDivisibleBy(Integer dividend, Integer divisor) {
        // Extracted for Single Responsibility Principle
        return dividend % divisor == 0;
    }
    
    /**
     * Batch processes a range of numbers
     * Uses Java 8 streams for functional paradigm compliance
     */
    public List<FizzBuzzResult> processBatch(int start, int end) {
        return IntStream.rangeClosed(start, end)
            .boxed()
            .map(this::process)
            .collect(java.util.stream.Collectors.toList());
    }
}

// Supporting classes (would normally be in separate files)
class FizzBuzzResult {
    private final Integer originalValue;
    private final String processedValue;
    private final Long timestamp;
    
    // Builder pattern because we're sophisticated
    public static FizzBuzzResultBuilder builder() {
        return new FizzBuzzResultBuilder();
    }
    
    static class FizzBuzzResultBuilder {
        private Integer originalValue;
        private String processedValue;
        private Long timestamp;
        
        public FizzBuzzResultBuilder originalValue(Integer val) {
            this.originalValue = val;
            return this;
        }
        
        public FizzBuzzResultBuilder processedValue(String val) {
            this.processedValue = val;
            return this;
        }
        
        public FizzBuzzResultBuilder timestamp(Long val) {
            this.timestamp = val;
            return this;
        }
        
        public FizzBuzzResult build() {
            return new FizzBuzzResult(originalValue, processedValue, timestamp);
        }
    }
    
    private FizzBuzzResult(Integer orig, String proc, Long ts) {
        this.originalValue = orig;
        this.processedValue = proc;
        this.timestamp = ts;
    }
}

class FizzBuzzException extends RuntimeException {
    public FizzBuzzException(String message) {
        super(message);
    }
}`,
};
