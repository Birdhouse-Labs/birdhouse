// ABOUTME: PowerShell code sample for syntax highlighting demo
// ABOUTME: Demonstrates sysadmin automation, cmdlets, pipelines, and error handling

import type { CodeSample } from "./types";

export const powershell: CodeSample = {
  id: "powershell",
  name: "PowerShell",
  language: "powershell",
  description: 'A sysadmin tool for managing "temporary" test servers that lived way too long',
  code: `# Script: Cleanup-ForgottenServers.ps1
# Description: Find and decommission those "temporary" test VMs from 2019

#Requires -Version 5.1
#Requires -Modules Az.Compute

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $false)]
    [string]$ResourceGroupPattern = "*-test-*",
    
    [Parameter(Mandatory = $false)]
    [int]$AgeInDays = 365,
    
    [switch]$IncludeWeekends,
    [switch]$DryRun = $true
)

# Because everyone needs a little color in their logs
function Write-ColorOutput {
    param(
        [string]$Message,
        [ValidateSet('Info', 'Warning', 'Error', 'Success')]
        [string]$Level = 'Info'
    )
    
    $colors = @{
        Info    = 'Cyan'
        Warning = 'Yellow'
        Error   = 'Red'
        Success = 'Green'
    }
    
    Write-Host "[$Level] $Message" -ForegroundColor $colors[$Level]
}

# Get all VMs matching our "definitely temporary" naming scheme
function Get-ForgottenServers {
    param([string]$Pattern, [int]$Days)
    
    Write-ColorOutput "Searching for VMs older than $Days days..." -Level Info
    
    try {
        $resourceGroups = Get-AzResourceGroup | Where-Object {
            $_.ResourceGroupName -like $Pattern
        }
        
        $forgottenVMs = foreach ($rg in $resourceGroups) {
            Get-AzVM -ResourceGroupName $rg.ResourceGroupName | ForEach-Object {
                $vm = $_
                $vmDetails = Get-AzVM -ResourceGroupName $rg.ResourceGroupName -Name $vm.Name -Status
                
                # Calculate VM age with the precision of a paranoid accountant
                $creationTime = $vm.TimeCreated
                $age = (Get-Date) - $creationTime
                
                if ($age.TotalDays -gt $Days) {
                    [PSCustomObject]@{
                        Name              = $vm.Name
                        ResourceGroup     = $rg.ResourceGroupName
                        Location          = $vm.Location
                        Size              = $vm.HardwareProfile.VmSize
                        Status            = ($vmDetails.Statuses | Where-Object { $_.Code -like 'PowerState/*' }).DisplayStatus
                        AgeInDays         = [math]::Round($age.TotalDays, 0)
                        CreatedBy         = $rg.Tags['CreatedBy'] ?? 'Unknown (probably Dave)'
                        Purpose           = $rg.Tags['Purpose'] ?? 'Temporary (sure it is)'
                        MonthlyCostEstimate = Get-VMCostEstimate -Size $vm.HardwareProfile.VmSize
                    }
                }
            }
        }
        
        return $forgottenVMs
    }
    catch {
        Write-ColorOutput "Failed to fetch VMs: $($_.Exception.Message)" -Level Error
        throw
    }
}

# Estimate the money we're burning monthly (based on made-up but plausible math)
function Get-VMCostEstimate {
    param([string]$Size)
    
    $costs = @{
        'Standard_B2s'  = 30.00
        'Standard_D2s'  = 70.00
        'Standard_D4s'  = 140.00
        'Standard_E8s'  = 400.00
        'default'       = 100.00  # Optimistic estimate
    }
    
    return $costs[$Size] ?? $costs['default']
}

# Main execution block - where the magic (and regret) happens
Write-ColorOutput "=== Forgotten Server Cleanup Tool ===" -Level Info
Write-ColorOutput "Current time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -Level Info

if ($DryRun) {
    Write-ColorOutput "Running in DRY RUN mode. No actual changes will be made." -Level Warning
}

$servers = Get-ForgottenServers -Pattern $ResourceGroupPattern -Days $AgeInDays

if ($servers.Count -eq 0) {
    Write-ColorOutput "No forgotten servers found. Either you're organized or we need better search." -Level Success
    exit 0
}

# Display the wall of shame
Write-ColorOutput "Found $($servers.Count) forgotten servers:" -Level Warning
$servers | Format-Table -AutoSize

$totalMonthlyCost = ($servers | Measure-Object -Property MonthlyCostEstimate -Sum).Sum
Write-ColorOutput "Estimated monthly waste: \`$$totalMonthlyCost" -Level Error

# Decommission servers (or pretend to, if DryRun)
foreach ($server in $servers) {
    $action = "Decommission VM: $($server.Name)"
    
    if ($PSCmdlet.ShouldProcess($server.Name, "Remove VM")) {
        if (-not $DryRun) {
            try {
                Write-ColorOutput "Removing $($server.Name)..." -Level Info
                Remove-AzVM -ResourceGroupName $server.ResourceGroup -Name $server.Name -Force
                Write-ColorOutput "Successfully removed $($server.Name)" -Level Success
            }
            catch {
                Write-ColorOutput "Failed to remove $($server.Name): $($_.Exception.Message)" -Level Error
            }
        }
        else {
            Write-ColorOutput "[DRY RUN] Would remove $($server.Name)" -Level Info
        }
    }
}

Write-ColorOutput "Cleanup complete. Coffee break recommended." -Level Success`,
};
