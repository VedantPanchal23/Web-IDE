// Scala Example - Functional + Object-oriented

object Hello {
  def main(args: Array[String]): Unit = {
    println("⚡ Hello from Scala!")
    
    // Variables
    val message = "Scala is powerful and elegant!"
    val number = 42
    
    println(s"Message: $message")
    println(s"Number: $number")
    
    // List
    val numbers = List(1, 2, 3, 4, 5)
    println(s"Numbers: ${numbers.mkString(", ")}")
    
    // Function call
    val result = add(10, 20)
    println(s"10 + 20 = $result")
    
    // Map
    val doubled = numbers.map(_ * 2)
    println(s"Doubled: ${doubled.mkString(", ")}")
    
    // Case class
    case class Person(name: String, age: Int)
    val person = Person("John", 30)
    println(s"\nPerson: $person")
  }
  
  def add(a: Int, b: Int): Int = a + b
}
