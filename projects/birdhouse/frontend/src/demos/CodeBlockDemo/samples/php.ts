// ABOUTME: PHP code sample for syntax highlighting demo
// ABOUTME: Demonstrates modern PHP 8.3+ features with Laravel-inspired elegance

import type { CodeSample } from "./types";

export const php: CodeSample = {
  id: "php",
  name: "PHP",
  language: "php",
  description: "A legacy codebase survival guide featuring modern PHP wizardry",
  code: `<?php

declare(strict_types=1);

namespace App\\Services\\LegacyRescue;

use DateTime;
use Exception;

/**
 * LegacyCodeRefactor - Where technical debt goes to be redeemed
 * 
 * This class demonstrates modern PHP 8.3 features including:
 * - Enums, readonly properties, constructor property promotion
 * - Named arguments, match expressions, union/intersection types
 * - Attributes, nullsafe operator, and the tears of past developers
 */

enum DeprecationSeverity: string {
    case MILD = 'mildly_concerning';
    case SPICY = 'definitely_gonna_break';
    case NUCLEAR = 'call_your_therapist';
}

readonly class TechnicalDebt {
    public function __construct(
        public string $description,
        public DeprecationSeverity $severity,
        public int $linesOfCode,
        public ?DateTime $lastTouched = null,
        public array $fearfulComments = [],
    ) {}
    
    public function getAnxietyScore(): float {
        $baseScore = $this->linesOfCode * 0.1;
        $severityMultiplier = match($this->severity) {
            DeprecationSeverity::MILD => 1.0,
            DeprecationSeverity::SPICY => 3.14159, // Pi for "pain"
            DeprecationSeverity::NUCLEAR => 9000.1, // Over 9000!
        };
        
        // Calculate years of neglect
        $yearsOfNeglect = $this->lastTouched?->diff(new DateTime())->y ?? 0;
        
        return $baseScore * $severityMultiplier * (1 + $yearsOfNeglect);
    }
}

#[LegacyWarning('Proceed with caution')]
class CodeArchaeologist {
    private array $discoveries = [];
    
    public function excavate(string $filePath): TechnicalDebt|null {
        // Nullsafe operator: because sometimes files just... disappear
        $content = @file_get_contents($filePath)?->toString() ?? null;
        
        if ($content === null) {
            return null; // File is Schrödinger's cat - maybe it exists
        }
        
        // Extract concerning patterns (a.k.a "features")
        $concerningPatterns = [
            'mysql_query' => DeprecationSeverity::NUCLEAR,
            'eval(' => DeprecationSeverity::NUCLEAR,
            '@' => DeprecationSeverity::SPICY, // Error suppression operator
            'TODO' => DeprecationSeverity::MILD,
            'FIXME' => DeprecationSeverity::SPICY,
            'HACK' => DeprecationSeverity::SPICY,
            'XXX' => DeprecationSeverity::NUCLEAR,
        ];
        
        $foundSeverity = DeprecationSeverity::MILD;
        foreach ($concerningPatterns as $pattern => $severity) {
            if (str_contains($content, $pattern)) {
                $foundSeverity = $severity;
                break; // We've seen enough
            }
        }
        
        return new TechnicalDebt(
            description: "Legacy file: {$filePath}",
            severity: $foundSeverity,
            linesOfCode: count(explode("\\n", $content)),
            lastTouched: new DateTime('-' . rand(1, 10) . ' years'),
            fearfulComments: $this->extractFearfulComments($content),
        );
    }
    
    private function extractFearfulComments(string $content): array {
        // Classic developer anxiety preserved in amber
        return [
            "// DO NOT TOUCH - Dave's code from 2008",
            "// If you're reading this, I'm sorry",
            "// This works, don't ask me why",
            "// TODO: Refactor this before the heat death of the universe",
        ];
    }
}

// Usage: Documenting our technical debt with eloquence
$archaeologist = new CodeArchaeologist();
$debt = $archaeologist->excavate('includes/legacy/database.inc.php');

if ($debt !== null) {
    printf(
        "Anxiety Score: %.2f\\n",
        $debt->getAnxietyScore()
    );
    printf("Severity: %s\\n", $debt->severity->value);
    echo "Fearful Comments Found:\\n";
    foreach ($debt->fearfulComments as $comment) {
        echo "  - {$comment}\\n";
    }
}

// Modern PHP: Where we face our fears with type safety and enums`,
};
