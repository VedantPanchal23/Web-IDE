public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("☕ Hello from Java!");
        System.out.println("==============================");
        
        // Variables
        String projectName = "AI-IDE";
        String version = System.getProperty("java.version");
        
        System.out.println("Java version: " + version);
        System.out.println("Welcome to " + projectName + "!");
        
        // Array operations
        int[] numbers = {1, 2, 3, 4, 5};
        System.out.print("Numbers: ");
        for (int i = 0; i < numbers.length; i++) {
            System.out.print(numbers[i]);
            if (i < numbers.length - 1) System.out.print(", ");
        }
        System.out.println();
        
        System.out.print("Squares: ");
        for (int i = 0; i < numbers.length; i++) {
            System.out.print(numbers[i] * numbers[i]);
            if (i < numbers.length - 1) System.out.print(", ");
        }
        System.out.println();
        
        // String operations
        String message = "Java execution in AI-IDE works perfectly!";
        System.out.println("Message length: " + message.length());
        System.out.println("Uppercase: " + message.toUpperCase());
        
        System.out.println("\n✅ Java execution complete!");
    }
}