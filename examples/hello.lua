-- Lua Example - Lightweight scripting

print("🌙 Hello from Lua!")

-- Variables
local message = "Lua is lightweight and fast!"
local number = 42

print("Message: " .. message)
print("Number: " .. number)

-- Table (array)
local numbers = {1, 2, 3, 4, 5}
print("Numbers: " .. table.concat(numbers, ", "))

-- Function
function add(a, b)
    return a + b
end

local result = add(10, 20)
print("10 + 20 = " .. result)

-- Table (dictionary)
local person = {
    name = "John",
    age = 30,
    city = "New York"
}

print("\nPerson Info:")
for key, value in pairs(person) do
    print("  " .. key .. ": " .. value)
end
