// Package analytics - cardinality.go
// Tag cardinality guard for the analytics collector.
// Fixes: unbounded tag cardinality causing metrics DB explosion.
package analytics

import (
	"fmt"
	"sync"
)

const DefaultMaxTagCardinality = 20

// CardinalityError is returned when a MetricSample exceeds the max tag limit.
type CardinalityError struct {
	MetricName string
	TagCount   int
	MaxAllowed int
}

func (e *CardinalityError) Error() string {
	return fmt.Sprintf(
		"metric %q has %d tags, exceeds max cardinality of %d",
		e.MetricName, e.TagCount, e.MaxAllowed,
	)
}

// CardinalityGuard enforces a maximum number of tags per MetricSample.
type CardinalityGuard struct {
	mu         sync.RWMutex
	maxTags    int
	rejected   int64
	rejReasons map[string]int64
}

// NewCardinalityGuard creates a guard with a configurable max tag limit.
// If maxTags <= 0, DefaultMaxTagCardinality is used.
func NewCardinalityGuard(maxTags int) *CardinalityGuard {
	if maxTags <= 0 {
		maxTags = DefaultMaxTagCardinality
	}
	return &CardinalityGuard{
		maxTags:    maxTags,
		rejReasons: make(map[string]int64),
	}
}

// Validate checks a MetricSample against the cardinality limit.
// Returns nil if within limit, *CardinalityError if exceeded.
// Rejected samples are tracked per-metric for observability.
func (g *CardinalityGuard) Validate(s *MetricSample) error {
	if len(s.Tags) <= g.maxTags {
		return nil
	}
	g.mu.Lock()
	g.rejected++
	g.rejReasons[s.Name]++
	g.mu.Unlock()
	return &CardinalityError{
		MetricName: s.Name,
		TagCount:   len(s.Tags),
		MaxAllowed: g.maxTags,
	}
}

// Stats returns total rejected samples and per-metric breakdown.
func (g *CardinalityGuard) Stats() (int64, map[string]int64) {
	g.mu.RLock()
	defer g.mu.RUnlock()
	cp := make(map[string]int64, len(g.rejReasons))
	for k, v := range g.rejReasons {
		cp[k] = v
	}
	return g.rejected, cp
}

// WithCardinalityGuard attaches a CardinalityGuard to the Collector.
// Samples exceeding the tag limit are dropped before queuing with a
// clear rejection reason recorded in the guard stats.
func (c *Collector) WithCardinalityGuard(maxTags int) *Collector {
	c.cardGuard = NewCardinalityGuard(maxTags)
	return c
}
