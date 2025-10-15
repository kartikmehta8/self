package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	self "github.com/selfxyz/self/sdk/sdk-go"
	"github.com/selfxyz/self/sdk/sdk-go/common"
	"github.com/selfxyz/self/sdk/tests/go-api/config"
)

type VerifyRequest struct {
	AttestationID   interface{} `json:"attestationId"`
	Proof           interface{} `json:"proof"`
	PublicSignals   interface{} `json:"publicSignals"`
	UserContextData interface{} `json:"userContextData"`
	UserID          string      `json:"userId,omitempty"`
}

type VerifyResponse struct {
	Status              string      `json:"status"`
	Result              bool        `json:"result"`
	Message             string      `json:"message,omitempty"`
	Details             interface{} `json:"details,omitempty"`
	CredentialSubject   interface{} `json:"credentialSubject,omitempty"`
	VerificationOptions interface{} `json:"verificationOptions,omitempty"`
}

// Global config store instance - similar to TypeScript version
var configStoreInstance *config.InMemoryConfigStore

func init() {
	var err error
	configStoreInstance, err = config.NewKVConfigStoreFromEnv()
	if err != nil {
		log.Printf("Failed to initialize config store: %v", err)
		return
	}

	ctx := context.Background()
	_, _ = configStoreInstance.SetConfig(ctx, "1", self.VerificationConfig{
		MinimumAge:        18,
		ExcludedCountries: []common.Country3LetterCode{common.PAK, common.IRN},
		Ofac:              false,
	})
}

// VerifyHandler handles the verification endpoint
func VerifyHandler(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"message": "Method not allowed"})
		return
	}

	w.Header().Set("Content-Type", "application/json")

	var req VerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid JSON"})
		return
	}

	// Validate required fields - equivalent to TypeScript validation
	if req.Proof == nil || req.PublicSignals == nil || req.AttestationID == nil || req.UserContextData == nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Proof, publicSignals, attestationId and userContextData are required",
		})
		return
	}

	// Convert attestationId to int
	var attestationIdInt int
	switch v := req.AttestationID.(type) {
	case float64:
		attestationIdInt = int(v)
	case string:
		var err error
		attestationIdInt, err = strconv.Atoi(v)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"message": "Invalid attestation ID format"})
			return
		}
	default:
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid attestation ID type"})
		return
	}

	// Convert req.Proof to self.VcAndDiscloseProof
	proofBytes, err := json.Marshal(req.Proof)
	if err != nil {
		log.Printf("Failed to marshal proof: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid proof format"})
		return
	}

	var vcProof self.VcAndDiscloseProof
	if err := json.Unmarshal(proofBytes, &vcProof); err != nil {
		log.Printf("Failed to unmarshal proof to VcAndDiscloseProof: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid proof structure"})
		return
	}

	// Convert req.PublicSignals to []string
	publicSignalsBytes, err := json.Marshal(req.PublicSignals)
	if err != nil {
		log.Printf("Failed to marshal public signals: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid public signals format"})
		return
	}

	var publicSignals []string
	if err := json.Unmarshal(publicSignalsBytes, &publicSignals); err != nil {
		log.Printf("Failed to unmarshal public signals to []string: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"message": "Invalid public signals structure"})
		return
	}

	// Convert req.UserContextData to string
	var userContextDataStr string
	switch v := req.UserContextData.(type) {
	case string:
		userContextDataStr = v
	default:
		// If not string, marshal to JSON and then remove quotes
		userContextDataBytes, err := json.Marshal(req.UserContextData)
		if err != nil {
			log.Printf("Failed to marshal user context data: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"message": "Invalid user context data format"})
			return
		}
		// Remove surrounding quotes if it's a JSON string
		if len(userContextDataBytes) >= 2 && userContextDataBytes[0] == '"' && userContextDataBytes[len(userContextDataBytes)-1] == '"' {
			userContextDataStr = string(userContextDataBytes[1 : len(userContextDataBytes)-1])
		} else {
			userContextDataStr = string(userContextDataBytes)
		}
	}

	ctx := context.Background()
	// Check if global config store is available
	if configStoreInstance == nil {
		log.Printf("Config store not initialized")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(VerifyResponse{
			Status:  "error",
			Result:  false,
			Message: "Internal server error",
		})
		return
	}

	// Set verification config like TypeScript version
	verificationConfig, err := configStoreInstance.GetConfig(ctx, "1")
	if err != nil {
		log.Printf("Failed to get verification config: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(VerifyResponse{
			Status:  "error",
			Result:  false,
			Message: "Internal server error",
		})
		return
	}

	// Define allowed attestation types
	allowedIds := map[self.AttestationId]bool{
		self.Passport: true,
		self.EUCard:   true,
		self.Aadhaar:  true,
	}

	// Use the same verifyEndpoint as TypeScript API to match scope calculation
	verifyEndpoint := "http://localhost:3000"

	verifier, err := self.NewBackendVerifier(
		"self-playground",
		verifyEndpoint,
		true, // Use testnet for testing
		allowedIds,
		configStoreInstance,
		self.UserIDTypeUUID, // Use UUID format for user IDs
	)
	if err != nil {
		log.Printf("Failed to initialize verifier: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(VerifyResponse{
			Status:  "error",
			Result:  false,
			Message: "Internal server error",
		})
		return
	}

	result, err := verifier.Verify(
		ctx,
		attestationIdInt,
		vcProof,
		publicSignals,
		userContextDataStr,
	)
	if err != nil {
		log.Printf("Verification failed: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(VerifyResponse{
			Status:  "error",
			Result:  false,
			Message: err.Error(),
		})
		return
	}

	if result == nil || !result.IsValidDetails.IsValid {
		log.Printf("Verification failed - invalid result")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(VerifyResponse{
			Status:  "error",
			Result:  false,
			Message: "Verification failed",
			Details: result.IsValidDetails,
		})
		return
	}

	// Default disclosure configuration (show all fields) like TypeScript version
	trueVal := true
	saveOptions := config.SelfAppDisclosureConfig{
		IssuingState:      &trueVal,
		Name:              &trueVal,
		Nationality:       &trueVal,
		DateOfBirth:       &trueVal,
		PassportNumber:    &trueVal,
		Gender:            &trueVal,
		ExpiryDate:        &trueVal,
		MinimumAge:        &verificationConfig.MinimumAge,
		Ofac:              &verificationConfig.Ofac,
		ExcludedCountries: verificationConfig.ExcludedCountries,
	}

	// Check if verification is valid
	if result.IsValidDetails.IsValid {
		// Create filtered subject - copy the struct to modify it
		filteredSubject := result.DiscloseOutput

		// Apply disclosure filters based on saveOptions - equivalent to TypeScript conditions

		if saveOptions.IssuingState == nil || !*saveOptions.IssuingState {
			filteredSubject.IssuingState = "Not disclosed"
		}

		if saveOptions.Name == nil || !*saveOptions.Name {
			filteredSubject.Name = "Not disclosed"
		}

		if saveOptions.Nationality == nil || !*saveOptions.Nationality {
			filteredSubject.Nationality = "Not disclosed"
		}

		if saveOptions.DateOfBirth == nil || !*saveOptions.DateOfBirth {
			filteredSubject.DateOfBirth = "Not disclosed"
		}

		if saveOptions.PassportNumber == nil || !*saveOptions.PassportNumber {
			filteredSubject.IdNumber = "Not disclosed"
		}

		if saveOptions.Gender == nil || !*saveOptions.Gender {
			filteredSubject.Gender = "Not disclosed"
		}

		if saveOptions.ExpiryDate == nil || !*saveOptions.ExpiryDate {
			filteredSubject.ExpiryDate = "Not disclosed"
		}

		// Create excluded countries array with country code mapping (like TypeScript)
		var excludedCountriesForResponse []string
		if saveOptions.ExcludedCountries != nil {
			excludedCountriesForResponse = make([]string, len(saveOptions.ExcludedCountries))
			for i, countryCode := range saveOptions.ExcludedCountries {
				excludedCountriesForResponse[i] = string(countryCode)
			}
		}

		// Return successful verification result with filtered data
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(VerifyResponse{
			Status:            "success",
			Result:            result.IsValidDetails.IsValid,
			CredentialSubject: filteredSubject,
			VerificationOptions: map[string]interface{}{
				"minimumAge":        saveOptions.MinimumAge,
				"ofac":              saveOptions.Ofac,
				"excludedCountries": excludedCountriesForResponse,
			},
		})
	} else {
		// Handle failed verification case
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(VerifyResponse{
			Status:  "error",
			Result:  result.IsValidDetails.IsValid,
			Message: "Verification failed",
			Details: result,
		})
	}
}
