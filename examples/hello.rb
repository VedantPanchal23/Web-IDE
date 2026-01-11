#!/usr/bin/env ruby
# Ruby Example - Elegant and expressive

puts "💎 Hello from Ruby!"

# Variables
message = "Ruby makes programmers happy!"
number = 42

puts "Message: #{message}"
puts "Number: #{number}"

# Array
numbers = [1, 2, 3, 4, 5]
puts "Numbers: #{numbers.join(', ')}"

# Function (method)
def add(a, b)
  a + b
end

result = add(10, 20)
puts "10 + 20 = #{result}"

# Hash
person = {
  name: "John",
  age: 30,
  city: "New York"
}

puts "\nPerson Info:"
person.each do |key, value|
  puts "  #{key}: #{value}"
end

# Block iteration
puts "\nSquares:"
(1..5).each do |n|
  puts "  #{n}² = #{n * n}"
end
