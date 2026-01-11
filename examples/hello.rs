// Rust Example - Safe Systems Programming

fn main() {
    println!("🦀 Hello from Rust!");
    
    // Variables
    let message = "Rust is blazingly fast!";
    let number: i32 = 42;
    
    println!("Message: {}", message);
    println!("Number: {}", number);
    
    // Vector
    let numbers = vec![1, 2, 3, 4, 5];
    println!("Numbers: {:?}", numbers);
    
    // Function call
    let result = add(10, 20);
    println!("10 + 20 = {}", result);
    
    // Pattern matching
    let value = Some(5);
    match value {
        Some(n) => println!("Got value: {}", n),
        None => println!("No value"),
    }
}

fn add(a: i32, b: i32) -> i32 {
    a + b
}
