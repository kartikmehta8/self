#!/bin/bash

# Self SDK API Services Management Script
# This script helps manage both TypeScript and Go API services from the sdk directory

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  up          Start both APIs (detached)"
    echo "  up-logs     Start both APIs with logs"
    echo "  down        Stop both APIs"
    echo "  restart     Restart both APIs"
    echo "  logs        Show logs from both services"
    echo "  logs-ts     Show logs from TypeScript API only"
    echo "  logs-go     Show logs from Go API only"
    echo "  status      Show status of both services"
    echo "  build       Build both Docker images"
    echo "  clean       Stop services and remove containers/volumes"
    echo "  help        Show this help message"
    echo ""
    echo "Note: Run this script from the sdk directory"
    echo "Services will be available at:"
    echo "  - TypeScript API: http://localhost:3000"
    echo "  - Go API: http://localhost:8080"
}

# Check if docker and docker-compose are available
check_requirements() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available"
        exit 1
    fi
}

# Check if we're in the correct directory
check_directory() {
    if [[ ! -f "docker-compose.yml" ]]; then
        print_error "docker-compose.yml not found. Please run this script from the sdk directory."
        exit 1
    fi

    if [[ ! -d "tests/ts-api" ]] || [[ ! -d "tests/go-api" ]]; then
        print_error "API test directories not found. Please run this script from the sdk directory."
        exit 1
    fi
}

# Function to get docker-compose command (handle both docker-compose and docker compose)
get_compose_cmd() {
    if command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    else
        echo "docker compose"
    fi
}

# Main script logic
main() {
    local command=${1:-help}
    local compose_cmd

    check_requirements
    check_directory
    compose_cmd=$(get_compose_cmd)

    case "$command" in
        "up")
            print_status "Starting both API services..."
            $compose_cmd up -d
            print_success "Services started!"
            echo "  - TypeScript API: http://localhost:3000"
            echo "  - Go API: http://localhost:8080"
            ;;
        "up-logs")
            print_status "Starting both API services with logs..."
            $compose_cmd up
            ;;
        "down")
            print_status "Stopping both API services..."
            $compose_cmd down
            print_success "Services stopped"
            ;;
        "restart")
            print_status "Restarting both API services..."
            $compose_cmd restart
            print_success "Services restarted"
            ;;
        "logs")
            print_status "Showing logs from both services (Press Ctrl+C to exit)..."
            $compose_cmd logs -f
            ;;
        "logs-ts")
            print_status "Showing logs from TypeScript API (Press Ctrl+C to exit)..."
            $compose_cmd logs -f ts-api
            ;;
        "logs-go")
            print_status "Showing logs from Go API (Press Ctrl+C to exit)..."
            $compose_cmd logs -f go-api
            ;;
        "status")
            print_status "Service status:"
            $compose_cmd ps
            ;;
        "build")
            print_status "Building both Docker images..."
            $compose_cmd build
            print_success "Build completed"
            ;;
        "clean")
            print_warning "This will stop services and remove containers and volumes"
            read -p "Are you sure? (y/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                print_status "Cleaning up..."
                $compose_cmd down -v --remove-orphans
                print_success "Cleanup completed"
            else
                print_status "Cleanup cancelled"
            fi
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run the main function with all arguments
main "$@"
