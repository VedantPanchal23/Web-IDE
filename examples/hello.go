package main

import "fmt"

func main() {
    fmt.Println("Hello from Go!")
    
    // Variables and types
    var message string = "Go is awesome!"
    number := 42
    
    fmt.Printf("Message: %s\n", message)
    fmt.Printf("Number: %d\n", number)
    
    // Slice
    numbers := []int{1, 2, 3, 4, 5}
    fmt.Println("Numbers:", numbers)
    
    // Function call
    result := add(10, 20)
    fmt.Printf("10 + 20 = %d\n", result)
}

func add(a, b int) int {
    return a + b
}
