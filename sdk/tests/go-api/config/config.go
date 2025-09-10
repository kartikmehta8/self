package config

import (
	"context"
	"sync"
	"time"

	self "github.com/selfxyz/self/sdk/sdk-go"
	"github.com/selfxyz/self/sdk/sdk-go/common"
)

// SelfAppDisclosureConfig matches TypeScript interface for disclosure options
type SelfAppDisclosureConfig struct {
	MinimumAge        *int                        `json:"minimumAge,omitempty"`
	Ofac              *bool                       `json:"ofac,omitempty"`
	ExcludedCountries []common.Country3LetterCode `json:"excludedCountries,omitempty"`
	IssuingState      *bool                       `json:"issuing_state,omitempty"`
	Name              *bool                       `json:"name,omitempty"`
	Nationality       *bool                       `json:"nationality,omitempty"`
	DateOfBirth       *bool                       `json:"date_of_birth,omitempty"`
	PassportNumber    *bool                       `json:"passport_number,omitempty"`
	Gender            *bool                       `json:"gender,omitempty"`
	ExpiryDate        *bool                       `json:"expiry_date,omitempty"`
}

// OptionStore represents a stored option with expiration
type OptionStore struct {
	Data   string    `json:"data"`
	Expiry time.Time `json:"expiry"`
}

// InMemoryConfigStore provides in-memory storage for configurations and options
type InMemoryConfigStore struct {
	mu      sync.RWMutex
	configs map[string]self.VerificationConfig
	options map[string]OptionStore
}

// NewInMemoryConfigStore creates a new in-memory config store
func NewInMemoryConfigStore() *InMemoryConfigStore {
	return &InMemoryConfigStore{
		configs: make(map[string]self.VerificationConfig),
		options: make(map[string]OptionStore),
	}
}

// GetActionId implements the ConfigStore interface
func (store *InMemoryConfigStore) GetActionId(ctx context.Context, userIdentifier string, userDefinedData string) (string, error) {
	if userDefinedData == "68656c6c6f2066726f6d2074686520706c617967726f756e64" {
		return "1", nil
	}
	if userDefinedData == "68656c6c6f2066726f6d2074686520706c617967726f756e65" {
		return "2", nil
	}

	return "", nil
}

// SetConfig implements the ConfigStore interface
func (store *InMemoryConfigStore) SetConfig(ctx context.Context, id string, config self.VerificationConfig) (bool, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	_, existed := store.configs[id]
	store.configs[id] = config
	return !existed, nil
}

// GetConfig implements the ConfigStore interface and returns self.VerificationConfig
func (store *InMemoryConfigStore) GetConfig(ctx context.Context, id string) (self.VerificationConfig, error) {
	// If found in regular config store, return it
	store.mu.RLock()
	config, exists := store.configs[id]
	store.mu.RUnlock()

	if exists {
		return config, nil
	}

	// Return empty config if not found (SDK will handle this)
	return self.VerificationConfig{}, nil
}

// Close cleans up resources (no-op for in-memory store)
func (store *InMemoryConfigStore) Close() error {
	return nil
}

// Global instance for the API
var globalConfigStore = NewInMemoryConfigStore()

// NewKVConfigStoreFromEnv creates a new config store (in-memory version)
func NewKVConfigStoreFromEnv() (*InMemoryConfigStore, error) {
	return globalConfigStore, nil
}
