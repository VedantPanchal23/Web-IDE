// Kotlin Example - Modern JVM language

fun main() {
    println("🎯 Hello from Kotlin!")
    
    // Variables
    val message = "Kotlin is concise and safe!"
    val number = 42
    
    println("Message: $message")
    println("Number: $number")
    
    // List
    val numbers = listOf(1, 2, 3, 4, 5)
    println("Numbers: ${numbers.joinToString(", ")}")
    
    // Function call
    val result = add(10, 20)
    println("10 + 20 = $result")
    
    // Data class
    val person = Person("John", 30)
    println("\nPerson: $person")
    
    // Lambda
    val doubled = numbers.map { it * 2 }
    println("Doubled: ${doubled.joinToString(", ")}")
}

fun add(a: Int, b: Int): Int {
    return a + b
}

data class Person(val name: String, val age: Int)
