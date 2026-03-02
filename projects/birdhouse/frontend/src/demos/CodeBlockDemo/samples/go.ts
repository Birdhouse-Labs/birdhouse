// ABOUTME: Go code sample for syntax highlighting demo
// ABOUTME: Demonstrates goroutines, channels, interfaces, and error handling

import type { CodeSample } from "./types";

export const go: CodeSample = {
  id: "go",
  name: "Go",
  language: "go",
  description: "A microservice that proves you needed a microservice",
  code: `// Package wisdom provides enterprise-grade wisdom as a service.
// Because sometimes you need a distributed system to tell you to drink water.
package wisdom

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"sync"
	"time"
)

// Wisdom represents a piece of advice that probably won't help.
type Wisdom struct {
	ID        string
	Text      string
	Relevance float64 // 0.0 to 1.0, usually closer to 0.0
	Source    string
}

// WisdomService dispenses advice through unnecessary complexity.
type WisdomService struct {
	mu       sync.RWMutex
	wisdoms  []Wisdom
	requests uint64
}

// NewWisdomService creates a new service. Consider not doing this.
func NewWisdomService() *WisdomService {
	return &WisdomService{
		wisdoms: []Wisdom{
			{ID: "w1", Text: "Have you tried turning it off and on again?", Relevance: 0.9, Source: "IT Crowd"},
			{ID: "w2", Text: "It works on my machine", Relevance: 0.1, Source: "Every Developer"},
			{ID: "w3", Text: "We should rewrite this in Rust", Relevance: 0.3, Source: "That One Coworker"},
			{ID: "w4", Text: "Let's circle back on that", Relevance: 0.0, Source: "Middle Management"},
			{ID: "w5", Text: "This meeting could've been an email", Relevance: 1.0, Source: "Universal Truth"},
		},
	}
}

// GetWisdom retrieves wisdom. May block. May not help.
func (s *WisdomService) GetWisdom(ctx context.Context) (*Wisdom, error) {
	// Simulate microservice latency for authenticity
	delay := time.Duration(rand.Intn(100)) * time.Millisecond
	
	select {
	case <-time.After(delay):
		s.mu.Lock()
		s.requests++
		s.mu.Unlock()
		
		s.mu.RLock()
		defer s.mu.RUnlock()
		
		if len(s.wisdoms) == 0 {
			return nil, errors.New("wisdom exhausted, please hydrate")
		}
		
		w := s.wisdoms[rand.Intn(len(s.wisdoms))]
		return &w, nil
		
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// StreamWisdom provides a continuous stream of wisdom via channels.
// Because why get one piece of advice when you can get infinite?
func (s *WisdomService) StreamWisdom(ctx context.Context) <-chan Wisdom {
	ch := make(chan Wisdom)
	
	go func() {
		defer close(ch)
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		
		for {
			select {
			case <-ticker.C:
				w, err := s.GetWisdom(ctx)
				if err != nil {
					return
				}
				select {
				case ch <- *w:
				case <-ctx.Done():
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()
	
	return ch
}

// Stats returns metrics that will end up in a dashboard nobody checks.
func (s *WisdomService) Stats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	return map[string]interface{}{
		"total_wisdoms":     len(s.wisdoms),
		"requests_served":   s.requests,
		"average_relevance": 0.42, // Close enough
	}
}

func main() {
	svc := NewWisdomService()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	for w := range svc.StreamWisdom(ctx) {
		fmt.Printf("[%.1f relevance] %s\\n", w.Relevance, w.Text)
	}
}`,
};
