# R example - Statistical computing and graphics!

cat("📊 Hello from R!\n")
cat("R: Language for data analysis and statistics\n\n")

# Variables
message <- "Welcome to AI-IDE"
cat(message, "\n")

# Function
add <- function(a, b) {
  return(a + b)
}

sum_result <- add(5, 10)
cat("5 + 10 =", sum_result, "\n")

# Vector example
numbers <- c(1, 2, 3, 4, 5)
total <- sum(numbers)
cat("Sum of vector:", total, "\n")

# Loop example
for (num in numbers) {
  cat("Number:", num, "\n")
}

# Data frame example
df <- data.frame(
  name = c("Alice", "Bob", "Charlie"),
  age = c(25, 30, 35),
  score = c(85, 90, 95)
)

cat("\nData frame:\n")
print(df)

# Statistical summary
cat("\nSummary:\n")
print(summary(df$age))
