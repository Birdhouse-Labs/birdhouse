// ABOUTME: R code sample for syntax highlighting demo
// ABOUTME: Demonstrates data analysis, ggplot2 visualization, and statistical modeling

import type { CodeSample } from "./types";

export const r: CodeSample = {
  id: "r",
  name: "R",
  language: "r",
  description: "A data scientist analyzing the correlation between coffee consumption and code quality",
  code: `# The Great Coffee vs Code Quality Study
# Where we finally answer: Does more coffee = better code?

library(tidyverse)
library(ggplot2)

# Generate some highly scientific research data
set.seed(42)  # The answer to everything

coffee_study <- tibble(
  developer_id = 1:100,
  cups_of_coffee = rnorm(100, mean = 5, sd = 2),
  hours_slept = rnorm(100, mean = 6, sd = 1.5),
  lines_of_code = rpois(100, lambda = 300),
  bugs_per_kloc = rgamma(100, shape = 2, scale = 10),
  existential_dread = runif(100, min = 0, max = 10),
  # The legendary 10x developer multiplier
  is_10x_dev = sample(c(TRUE, FALSE), 100, replace = TRUE, prob = c(0.05, 0.95))
)

# Data wrangling: the most honest part of any analysis
coffee_study <- coffee_study %>%
  mutate(
    cups_of_coffee = pmax(0, cups_of_coffee),  # No negative coffee (sadly)
    hours_slept = pmax(2, pmin(12, hours_slept)),  # Realistic sleep bounds
    # Calculate code quality score (completely made up formula)
    code_quality = (lines_of_code / bugs_per_kloc) * 
                   (hours_slept / existential_dread) *
                   ifelse(is_10x_dev, 10, 1),
    # Categorize coffee consumption
    coffee_category = case_when(
      cups_of_coffee < 3 ~ "Decaf Heretic",
      cups_of_coffee < 6 ~ "Normal Human",
      cups_of_coffee < 9 ~ "Senior Developer",
      TRUE ~ "Caffeine Elemental"
    ),
    coffee_category = factor(coffee_category, 
                           levels = c("Decaf Heretic", "Normal Human", 
                                    "Senior Developer", "Caffeine Elemental"))
  )

# The moment of truth: linear regression
model <- lm(code_quality ~ cups_of_coffee + hours_slept + 
            existential_dread + is_10x_dev, 
            data = coffee_study)

# Print model summary (prepare to be disappointed)
summary(model)

# Calculate correlation between coffee and bugs
coffee_bug_cor <- cor(coffee_study$cups_of_coffee, 
                     coffee_study$bugs_per_kloc)
cat(sprintf("Coffee-Bug Correlation: %.3f\\n", coffee_bug_cor))
cat("(Positive = more coffee, more bugs. We don't talk about this.)\\n\\n")

# The mandatory ggplot2 visualization
ggplot(coffee_study, aes(x = cups_of_coffee, y = code_quality)) +
  geom_point(aes(color = coffee_category, size = lines_of_code), 
            alpha = 0.6) +
  geom_smooth(method = "lm", se = TRUE, color = "darkblue", linewidth = 1.2) +
  scale_color_manual(values = c("#E8DCC4", "#D4A574", "#8B4513", "#3E2723"),
                    name = "Coffee Consumption") +
  labs(
    title = "Coffee Consumption vs Code Quality",
    subtitle = "A totally scientific study with p < 0.05*",
    x = "Cups of Coffee per Day",
    y = "Code Quality Score (Higher = Better)",
    size = "Lines of Code",
    caption = "*p-value may or may not have been cherry-picked"
  ) +
  theme_minimal() +
  theme(
    plot.title = element_text(size = 16, face = "bold"),
    plot.subtitle = element_text(size = 12, color = "gray40"),
    legend.position = "right",
    panel.grid.minor = element_blank()
  )

# Advanced analysis: Does being a "10x developer" actually matter?
anova_result <- aov(code_quality ~ coffee_category * is_10x_dev, 
                   data = coffee_study)
summary(anova_result)

# Print the most caffeinated developer
most_caffeinated <- coffee_study %>%
  arrange(desc(cups_of_coffee)) %>%
  slice(1)

cat("\\n🏆 Most Caffeinated Developer:\\n")
cat(sprintf("  Developer #%d: %.1f cups/day\\n", 
           most_caffeinated$developer_id, 
           most_caffeinated$cups_of_coffee))
cat(sprintf("  Code Quality: %.2f\\n", most_caffeinated$code_quality))
cat(sprintf("  Existential Dread: %.1f/10\\n", most_caffeinated$existential_dread))

# Final wisdom
cat("\\n💡 Conclusion: Coffee doesn't cause bugs.\\n")
cat("   Bugs cause the need for coffee.\\n")`,
};
