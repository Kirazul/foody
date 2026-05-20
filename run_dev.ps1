param(
    [string]$BackendHost = "127.0.0.1",
    [int]$BackendPort = 8000,
    [string]$FrontendHost = "127.0.0.1",
    [int]$FrontendPort = 3000,
    [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"

$FoodyRoot = $PSScriptRoot
$BackendDir = Join-Path $FoodyRoot "backend"
$FrontendDir = Join-Path $FoodyRoot "frontend"
$BackendPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
$NextCli = Join-Path $FrontendDir "node_modules\.bin\next.cmd"
$BackendUrl = "http://${BackendHost}:${BackendPort}"
$FrontendUrl = "http://${FrontendHost}:${FrontendPort}"

function Get-PowerShellExe {
    $pwsh = Get-Command "pwsh" -ErrorAction SilentlyContinue
    if ($pwsh) {
        return $pwsh.Source
    }
    $powershell = Get-Command "powershell.exe" -ErrorAction SilentlyContinue
    if ($powershell) {
        return $powershell.Source
    }
    throw "PowerShell executable not found."
}

function Start-TerminalWindow {
    param(
        [string]$Title,
        [string]$Command
    )

    $psExe = Get-PowerShellExe
    $windowCommand = "`$Host.UI.RawUI.WindowTitle = '$Title'; $Command"
    $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($windowCommand))
    Start-Process -FilePath $psExe -ArgumentList @("-NoExit", "-EncodedCommand", $encodedCommand) -WindowStyle Normal | Out-Null
}

function Wait-HttpOk {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSeconds = 90
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Write-Host "$Name ready: $Url"
                return
            }
        }
        catch {
            Start-Sleep -Seconds 2
        }
    } while ((Get-Date) -lt $deadline)

    throw "$Name did not become ready at $Url within $TimeoutSeconds seconds."
}

function Test-HttpOk {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    }
    catch {
        return $false
    }
}

if (-not (Test-Path -LiteralPath $BackendPython)) {
    throw "Backend virtualenv Python not found: $BackendPython. Create it and install requirements first."
}

if (-not (Test-Path -LiteralPath (Join-Path $FrontendDir "package.json"))) {
    throw "Frontend package.json not found: $FrontendDir"
}

if (-not (Test-Path -LiteralPath $NextCli)) {
    throw "Next CLI not found: $NextCli. Run npm install in $FrontendDir first."
}

$backendCommand = "Set-Location -LiteralPath '$BackendDir'; & '$BackendPython' -m uvicorn foody.routes.main:app --host $BackendHost --port $BackendPort"
$frontendCommand = "Set-Location -LiteralPath '$FrontendDir'; `$env:NEXT_PUBLIC_FOODY_API_URL = '$BackendUrl'; & '$NextCli' dev --hostname $FrontendHost --port $FrontendPort"

if (Test-HttpOk "$BackendUrl/health") {
    Write-Host "Backend already running: $BackendUrl"
}
else {
    Start-TerminalWindow -Title "Foody Backend API" -Command $backendCommand
    Write-Host "Started Foody backend window: $BackendUrl"
}

if (Test-HttpOk $FrontendUrl) {
    Write-Host "Frontend already running: $FrontendUrl"
}
else {
    Start-TerminalWindow -Title "Foody Frontend" -Command $frontendCommand
    Write-Host "Started Foody frontend window: $FrontendUrl"
}

if (-not $SkipVerify) {
    Wait-HttpOk -Name "Backend health" -Url "$BackendUrl/health"
    Wait-HttpOk -Name "Backend metadata" -Url "$BackendUrl/metadata"
    Wait-HttpOk -Name "Frontend" -Url $FrontendUrl -TimeoutSeconds 120
}

Write-Host "Foody dev stack is ready."
