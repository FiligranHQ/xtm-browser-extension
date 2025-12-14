<#
.SYNOPSIS
    Local Test Runner Script for XTM Browser Extension

.DESCRIPTION
    This script helps run tests locally with optional OpenCTI/OpenAEV integration.

.PARAMETER Unit
    Run unit tests only

.PARAMETER OpenCTI
    Run OpenCTI integration tests

.PARAMETER OpenAEV
    Run OpenAEV integration tests

.PARAMETER All
    Run all tests

.PARAMETER Coverage
    Run tests with coverage

.PARAMETER Watch
    Run tests in watch mode

.EXAMPLE
    .\scripts\test-local.ps1 -Unit
    Run unit tests only

.EXAMPLE
    .\scripts\test-local.ps1 -OpenCTI
    Run OpenCTI integration tests

.EXAMPLE
    .\scripts\test-local.ps1 -All -Coverage
    Run all tests with coverage

.NOTES
    Environment Variables:
    - OPENCTI_URL: OpenCTI API URL (default: http://localhost:8080)
    - OPENCTI_TOKEN: OpenCTI API token
    - OPENAEV_URL: OpenAEV API URL (default: http://localhost:8080)
    - OPENAEV_TOKEN: OpenAEV API token
#>

param(
    [switch]$Unit,
    [switch]$OpenCTI,
    [switch]$OpenAEV,
    [switch]$All,
    [switch]$Coverage,
    [switch]$Watch
)

# Colors
$Blue = "Cyan"
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor $Blue
    Write-Host "║ $($Text.PadRight(58)) ║" -ForegroundColor $Blue
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $Blue
    Write-Host ""
}

function Write-Section {
    param([string]$Text)
    Write-Host $Text -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Text)
    Write-Host "⚠ $Text" -ForegroundColor $Yellow
}

function Write-Success {
    param([string]$Text)
    Write-Host "✓ $Text" -ForegroundColor $Green
}

function Write-Error {
    param([string]$Text)
    Write-Host "✗ $Text" -ForegroundColor $Red
}

function Test-WebEndpoint {
    param(
        [string]$Url,
        [string]$Token,
        [string]$ExpectedContent
    )
    
    try {
        $headers = @{}
        if ($Token) {
            $headers["Authorization"] = "Bearer $Token"
        }
        $response = Invoke-WebRequest -Uri $Url -Headers $headers -UseBasicParsing -ErrorAction SilentlyContinue
        return $response.Content -like "*$ExpectedContent*"
    }
    catch {
        return $false
    }
}

# Set default test selection
$RunUnit = $Unit
$RunOpenCTI = $OpenCTI
$RunOpenAEV = $OpenAEV

if ($All) {
    $RunUnit = $true
    $RunOpenCTI = $true
    $RunOpenAEV = $true
}

# If no specific test is selected, run unit tests
if (-not $RunUnit -and -not $RunOpenCTI -and -not $RunOpenAEV) {
    $RunUnit = $true
}

Write-Header "XTM Browser Extension - Test Runner"

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Warning "Installing dependencies..."
    npm install
}

# Run unit tests
if ($RunUnit) {
    Write-Section "Running unit tests..."
    
    if ($Watch) {
        npm run "test:watch" -- tests/unit
    }
    elseif ($Coverage) {
        npm run "test:coverage" -- tests/unit
    }
    else {
        npm run "test:unit"
    }
    
    Write-Success "Unit tests completed"
    Write-Host ""
}

# Run OpenCTI integration tests
if ($RunOpenCTI) {
    Write-Section "Running OpenCTI integration tests..."
    
    # Check for OpenCTI connection
    $OpenCTIUrl = if ($env:OPENCTI_URL) { $env:OPENCTI_URL } else { "http://localhost:8080" }
    $OpenCTIToken = $env:OPENCTI_TOKEN
    
    if (-not $OpenCTIToken) {
        Write-Warning "OPENCTI_TOKEN not set. Some tests may be skipped."
        Write-Warning "Set OPENCTI_TOKEN environment variable to run full integration tests."
    }
    else {
        # Test connection
        Write-Host "Testing connection to OpenCTI at $OpenCTIUrl..." -ForegroundColor $Blue
        
        $testUrl = "$OpenCTIUrl/graphql"
        $connected = $false
        
        try {
            $headers = @{
                "Authorization" = "Bearer $OpenCTIToken"
                "Content-Type" = "application/json"
            }
            $body = '{"query":"{ about { version } }"}'
            $response = Invoke-WebRequest -Uri $testUrl -Method POST -Headers $headers -Body $body -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.Content -like "*version*") {
                $connected = $true
                Write-Success "OpenCTI connection successful"
            }
        }
        catch {
            # Connection failed
        }
        
        if (-not $connected) {
            Write-Error "Cannot connect to OpenCTI. Check URL and token."
            Write-Warning "Running tests anyway (they may skip integration tests)..."
        }
    }
    
    $env:OPENCTI_URL = $OpenCTIUrl
    
    if ($Coverage) {
        npm run "test:coverage" -- --config vitest.config.opencti.ts
    }
    else {
        npm run "test:opencti"
    }
    
    Write-Success "OpenCTI integration tests completed"
    Write-Host ""
}

# Run OpenAEV integration tests
if ($RunOpenAEV) {
    Write-Section "Running OpenAEV integration tests..."
    
    # Check for OpenAEV connection
    $OpenAEVUrl = if ($env:OPENAEV_URL) { $env:OPENAEV_URL } else { "http://localhost:8080" }
    $OpenAEVToken = $env:OPENAEV_TOKEN
    
    if (-not $OpenAEVToken) {
        Write-Warning "OPENAEV_TOKEN not set. Some tests may be skipped."
        Write-Warning "Set OPENAEV_TOKEN environment variable to run full integration tests."
    }
    else {
        # Test connection
        Write-Host "Testing connection to OpenAEV at $OpenAEVUrl..." -ForegroundColor $Blue
        
        $testUrl = "$OpenAEVUrl/api/settings"
        $connected = $false
        
        try {
            $headers = @{
                "Authorization" = "Bearer $OpenAEVToken"
            }
            $response = Invoke-WebRequest -Uri $testUrl -Headers $headers -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.Content -like "*platform*") {
                $connected = $true
                Write-Success "OpenAEV connection successful"
            }
        }
        catch {
            # Connection failed
        }
        
        if (-not $connected) {
            Write-Error "Cannot connect to OpenAEV. Check URL and token."
            Write-Warning "Running tests anyway (they may skip integration tests)..."
        }
    }
    
    $env:OPENAEV_URL = $OpenAEVUrl
    
    if ($Coverage) {
        npm run "test:coverage" -- --config vitest.config.openaev.ts
    }
    else {
        npm run "test:openaev"
    }
    
    Write-Success "OpenAEV integration tests completed"
    Write-Host ""
}

Write-Header "All tests completed!"
